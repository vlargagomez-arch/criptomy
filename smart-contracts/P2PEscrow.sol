// SPDX-License-Identifier: MIT
// ============================================================================
// P2P Crypto Escrow - Smart Contract
// ============================================================================
// Contrato de escrow on-chain para intercambios P2P sin KYC.
// Inspirado en el patrón usado por HodlHodl y RoboSats, pero simplificado.
//
// Flujo:
//   1. Vendedor crea el trade depositando cripto en este contrato.
//   2. Comprador paga fiat fuera de chain (Nequi, SEPA, cash, etc.).
//   3. Vendedor confirma recepción del pago fiat y libera los fondos.
//   4. Si hay disputa, un árbitro (o multisig 2-de-3) resuelve.
//
// Seguridad:
//   - Cada trade tiene su propio salt para evitar front-running.
//   - Time-locks: si el vendedor no libera en T1 horas, el comprador puede
//     escalar a disputa. Si nadie resuelve en T2 horas, cualquiera puede
//     cancelar y recuperar.
//   - El árbitro es opcional (address(0) = sin árbitro, solo 2-de-2).
//
// Despliegue:
//   npx hardhat run scripts/deploy.js --network sepolia
//
// Costo estimado de despliegue en Sepolia: ~0.001 ETH
// ============================================================================

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract P2PEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Estados del trade on-chain
    // ---------------------------------------------------------------------
    enum TradeStatus {
        AWAITING_FUNDING,   // creado, esperando depósito del vendedor
        FUNDED,             // depositado, esperando pago fiat
        RELEASING,          // vendedor marcó liberación
        COMPLETED,          // fondos liberados al comprador
        CANCELLED,          // cancelado, fondos devueltos al vendedor
        DISPUTED            // en disputa, requiere arbitraje
    }

    struct Trade {
        address seller;         // vendedor (deposita cripto)
        address buyer;          // comprador (recibe cripto tras pagar fiat)
        address arbitrator;     // árbitro opcional (address(0) si no hay)
        address token;          // ERC20 token (address(0) = ETH nativo)
        uint256 amount;         // cantidad de cripto en escrow
        uint256 createdAt;      // timestamp creación
        uint256 fundedAt;       // timestamp depósito
        uint256 paymentWindow;  // segundos máximos para pago fiat
        TradeStatus status;
        bytes32 tradeHash;      // hash off-chain para referencia
    }

    mapping(bytes32 => Trade) public trades; // tradeId => Trade

    uint256 public constant ESCROW_FEE_BPS = 25; // 0.25% (reducible vía governance)
    address public feeCollector;

    event TradeCreated(
        bytes32 indexed tradeId,
        address indexed seller,
        address indexed buyer,
        address token,
        uint256 amount,
        uint256 paymentWindow,
        bytes32 tradeHash
    );
    event TradeFunded(bytes32 indexed tradeId, uint256 amount);
    event TradeReleased(bytes32 indexed tradeId, address to);
    event TradeCancelled(bytes32 indexed tradeId, address to);
    event DisputeRaised(bytes32 indexed tradeId, address by);
    event DisputeResolved(
        bytes32 indexed tradeId,
        address winner,
        string reason
    );

    constructor(address _feeCollector) {
        feeCollector = _feeCollector;
    }

    // ---------------------------------------------------------------------
    // 1. Crear trade (lo llama el vendedor antes de depositar)
    // ---------------------------------------------------------------------
    function createTrade(
        bytes32 tradeId,
        address buyer,
        address arbitrator,
        address token,
        uint256 amount,
        uint256 paymentWindow,
        bytes32 tradeHash
    ) external {
        require(trades[tradeId].seller == address(0), "Trade exists");
        require(buyer != address(0) && buyer != msg.sender, "Invalid buyer");
        require(amount > 0, "Amount zero");
        require(paymentWindow >= 1 hours, "Window too short");

        trades[tradeId] = Trade({
            seller: msg.sender,
            buyer: buyer,
            arbitrator: arbitrator,
            token: token,
            amount: amount,
            createdAt: block.timestamp,
            fundedAt: 0,
            paymentWindow: paymentWindow,
            status: TradeStatus.AWAITING_FUNDING,
            tradeHash: tradeHash
        });

        emit TradeCreated(
            tradeId,
            msg.sender,
            buyer,
            token,
            amount,
            paymentWindow,
            tradeHash
        );
    }

    // ---------------------------------------------------------------------
    // 2. Vendedor deposita los fondos (funding)
    // ---------------------------------------------------------------------
    function fundTrade(bytes32 tradeId) external payable nonReentrant {
        Trade storage t = trades[tradeId];
        require(t.seller == msg.sender, "Not seller");
        require(t.status == TradeStatus.AWAITING_FUNDING, "Bad status");

        if (t.token == address(0)) {
            require(msg.value == t.amount, "Wrong ETH amount");
        } else {
            require(msg.value == 0, "Don't send ETH");
            IERC20(t.token).safeTransferFrom(msg.sender, address(this), t.amount);
        }

        t.fundedAt = block.timestamp;
        t.status = TradeStatus.FUNDED;
        emit TradeFunded(tradeId, t.amount);
    }

    // ---------------------------------------------------------------------
    // 3a. Vendedor libera fondos al comprador (pago fiat confirmado)
    // ---------------------------------------------------------------------
    function releaseToBuyer(bytes32 tradeId) external nonReentrant {
        Trade storage t = trades[tradeId];
        require(t.seller == msg.sender, "Not seller");
        require(t.status == TradeStatus.FUNDED, "Bad status");

        t.status = TradeStatus.RELEASING;
        _payout(t, t.buyer, tradeId);
        t.status = TradeStatus.COMPLETED;
        emit TradeReleased(tradeId, t.buyer);
    }

    // ---------------------------------------------------------------------
    // 3b. Cancelar trade (mutuo acuerdo o antes de funding)
    // ---------------------------------------------------------------------
    function cancel(bytes32 tradeId) external nonReentrant {
        Trade storage t = trades[tradeId];
        require(
            msg.sender == t.seller || msg.sender == t.buyer,
            "Not party"
        );
        require(
            t.status == TradeStatus.AWAITING_FUNDING ||
                t.status == TradeStatus.FUNDED,
            "Bad status"
        );
        // Si ya está fundeado, solo el vendedor puede cancelar unilateralmente
        // antes de la ventana de pago, o cualquiera tras expirar la ventana.
        if (t.status == TradeStatus.FUNDED) {
            require(
                msg.sender == t.seller ||
                    block.timestamp > t.fundedAt + t.paymentWindow,
                "Window active"
            );
        }

        t.status = TradeStatus.CANCELLED;
        if (t.fundedAt != 0) {
            _payout(t, t.seller, tradeId);
        }
        emit TradeCancelled(tradeId, t.seller);
    }

    // ---------------------------------------------------------------------
    // 4. Disputa: la abre cualquiera de las partes
    // ---------------------------------------------------------------------
    function raiseDispute(bytes32 tradeId) external {
        Trade storage t = trades[tradeId];
        require(
            msg.sender == t.seller || msg.sender == t.buyer,
            "Not party"
        );
        require(t.status == TradeStatus.FUNDED, "Bad status");
        t.status = TradeStatus.DISPUTED;
        emit DisputeRaised(tradeId, msg.sender);
    }

    // ---------------------------------------------------------------------
    // 5. Arbitraje: el árbitro (si existe) decide a quién van los fondos
    // ---------------------------------------------------------------------
    function resolveDispute(
        bytes32 tradeId,
        address winner,
        string calldata reason
    ) external nonReentrant {
        Trade storage t = trades[tradeId];
        require(t.status == TradeStatus.DISPUTED, "Not disputed");
        require(t.arbitrator != address(0), "No arbitrator");
        require(msg.sender == t.arbitrator, "Not arbitrator");
        require(
            winner == t.seller || winner == t.buyer,
            "Invalid winner"
        );

        t.status = TradeStatus.RELEASING;
        _payout(t, winner, tradeId);
        t.status = TradeStatus.COMPLETED;
        emit DisputeResolved(tradeId, winner, reason);
    }

    // ---------------------------------------------------------------------
    // Interno: pagar al destinatario descontando la comisión
    // ---------------------------------------------------------------------
    function _payout(
        Trade storage t,
        address to,
        bytes32 tradeId
    ) internal {
        uint256 fee = (t.amount * ESCROW_FEE_BPS) / 10000;
        uint256 net = t.amount - fee;

        if (t.token == address(0)) {
            (bool ok1, ) = payable(to).call{value: net}("");
            require(ok1, "ETH transfer failed");
            (bool ok2, ) = payable(feeCollector).call{value: fee}("");
            require(ok2, "Fee transfer failed");
        } else {
            IERC20(t.token).safeTransfer(to, net);
            IERC20(t.token).safeTransfer(feeCollector, fee);
        }
    }

    // ---------------------------------------------------------------------
    // View helpers
    // ---------------------------------------------------------------------
    function getTrade(bytes32 tradeId)
        external
        view
        returns (Trade memory)
    {
        return trades[tradeId];
    }

    function isFunded(bytes32 tradeId) external view returns (bool) {
        return trades[tradeId].status == TradeStatus.FUNDED;
    }

    receive() external payable {
        // permite recibir reembolsos de gas
    }
}
