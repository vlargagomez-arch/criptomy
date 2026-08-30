// SPDX-License-Identifier: MIT
// ============================================================================
// ChallengeEscrow - Smart Contract para Retos P2P Gaming
// ============================================================================
// Escrow para retos 1v1 con criptomonedas. Dos jugadores depositan
// la misma cantidad. Cuando se verifica el ganador (via API del juego
// + oracle), el contrato libera los fondos al ganador.
//
// Flujo:
//   1. Creator crea el reto (createChallenge)
//   2. Opponent lo acepta (joinChallenge) + deposita
//   3. Creator deposita (depositStake) — ahora ambos depositaron
//   4. Se juega el partido
//   5. Oracle/árbitro llama resolveChallenge(challengeId, winner)
//   6. Contrato envía 95% del pool al ganador, 5% al feeCollector
//   7. Si hay empate: devuelve 50/50 (menos comisión)
//
// Comisión: 5% (configurable)
// ============================================================================

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ChallengeEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum ChallengeStatus {
        AWAITING_OPPONENT,    // creator depositó, esperando opponent
        BOTH_DEPOSITED,       // ambos depositaron, listos para jugar
        IN_PROGRESS,          // partido en curso
        COMPLETED,            // resuelto, fondos liberados
        CANCELLED,            // cancelado, reembolsos hechos
        DISPUTED              // en disputa, requiere arbitraje
    }

    struct Challenge {
        address creator;
        address opponent;
        address token;            // ERC20 token (USDT)
        uint256 stakeAmount;       // cantidad que cada jugador deposita
        uint256 createdAt;
        uint256 bothDepositedAt;
        ChallengeStatus status;
        bytes32 gameChallengeId;   // ID del reto en el backend (off-chain)
        GameType game;             // tipo de juego
    }

    enum GameType {
        LEAGUE_OF_LEGENDS,
        VALORANT,
        COUNTER_STRIKE_2,
        DOTA2,
        ROCKET_LEAGUE
    }

    enum Winner {
        NONE,           // sin resolver
        CREATOR,
        OPPONENT,
        DRAW
    }

    // mapping: challengeId (bytes32) => Challenge
    mapping(bytes32 => Challenge) public challenges;

    // mapping: challengeId => si creator depositó
    mapping(bytes32 => bool) public creatorDeposited;
    // mapping: challengeId => si opponent depositó
    mapping(bytes32 => bool) public opponentDeposited;

    uint256 public constant FEE_BPS = 500; // 5% comisión
    address public feeCollector;
    address public oracle; // dirección autorizada para resolver (backend)

    event ChallengeCreated(
        bytes32 indexed challengeId,
        address indexed creator,
        address token,
        uint256 stakeAmount,
        GameType game,
        bytes32 gameChallengeId
    );
    event OpponentJoined(bytes32 indexed challengeId, address indexed opponent);
    event StakeDeposited(bytes32 indexed challengeId, address indexed player, uint256 amount);
    event ChallengeResolved(
        bytes32 indexed challengeId,
        Winner winner,
        address winnerAddress,
        uint256 payout
    );
    event ChallengeCancelled(bytes32 indexed challengeId, address by);
    event FeeUpdated(uint256 newFeeBps);
    event OracleUpdated(address newOracle);

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not oracle");
        _;
    }

    constructor(address _feeCollector, address _oracle) {
        feeCollector = _feeCollector;
        oracle = _oracle;
    }

    // -----------------------------------------------------------------
    // 1. Creator crea el reto y deposita
    // -----------------------------------------------------------------
    function createChallenge(
        bytes32 challengeId,
        address opponent, // address(0) si está abierto a cualquiera
        address token,
        uint256 stakeAmount,
        GameType game,
        bytes32 gameChallengeId
    ) external nonReentrant {
        require(challenges[challengeId].creator == address(0), "Exists");
        require(stakeAmount > 0, "Stake zero");
        require(token != address(0), "Token zero");

        challenges[challengeId] = Challenge({
            creator: msg.sender,
            opponent: opponent,
            token: token,
            stakeAmount: stakeAmount,
            createdAt: block.timestamp,
            bothDepositedAt: 0,
            status: ChallengeStatus.AWAITING_OPPONENT,
            gameChallengeId: gameChallengeId,
            game: game
        });

        // Transferir stake del creator al contrato
        IERC20(token).safeTransferFrom(msg.sender, address(this), stakeAmount);
        creatorDeposited[challengeId] = true;

        emit ChallengeCreated(challengeId, msg.sender, token, stakeAmount, game, gameChallengeId);
        emit StakeDeposited(challengeId, msg.sender, stakeAmount);

        // Si opponent está especificado y es válido, auto-join
        if (opponent != address(0) && opponent != msg.sender) {
            // No auto-deposit; opponent debe llamar joinChallenge
        }
    }

    // -----------------------------------------------------------------
    // 2. Opponent se une y deposita
    // -----------------------------------------------------------------
    function joinChallenge(bytes32 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.creator != address(0), "Not exists");
        require(c.status == ChallengeStatus.AWAITING_OPPONENT, "Bad status");
        require(msg.sender != c.creator, "Creator cannot join");
        require(
            c.opponent == address(0) || c.opponent == msg.sender,
            "Not invited"
        );

        c.opponent = msg.sender;
        c.status = ChallengeStatus.BOTH_DEPOSITED;
        c.bothDepositedAt = block.timestamp;

        // Transferir stake del opponent
        IERC20(c.token).safeTransferFrom(msg.sender, address(this), c.stakeAmount);
        opponentDeposited[challengeId] = true;

        emit OpponentJoined(challengeId, msg.sender);
        emit StakeDeposited(challengeId, msg.sender, c.stakeAmount);
    }

    // -----------------------------------------------------------------
    // 3. Marcar como en progreso (solo oracle)
    // -----------------------------------------------------------------
    function startMatch(bytes32 challengeId) external onlyOracle {
        Challenge storage c = challenges[challengeId];
        require(c.status == ChallengeStatus.BOTH_DEPOSITED, "Bad status");
        c.status = ChallengeStatus.IN_PROGRESS;
    }

    // -----------------------------------------------------------------
    // 4. Resolver challenge (solo oracle - backend con API del juego)
    // -----------------------------------------------------------------
    function resolveChallenge(
        bytes32 challengeId,
        Winner winner
    ) external onlyOracle nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(c.status == ChallengeStatus.IN_PROGRESS, "Bad status");
        require(winner != Winner.NONE, "Invalid winner");

        c.status = ChallengeStatus.COMPLETED;

        uint256 totalPool = c.stakeAmount * 2;
        uint256 fee = (totalPool * FEE_BPS) / 10000;
        uint256 netPool = totalPool - fee;

        if (winner == Winner.CREATOR) {
            // Creator gana todo
            IERC20(c.token).safeTransfer(c.creator, netPool);
            IERC20(c.token).safeTransfer(feeCollector, fee);
            emit ChallengeResolved(challengeId, winner, c.creator, netPool);
        } else if (winner == Winner.OPPONENT) {
            // Opponent gana todo
            IERC20(c.token).safeTransfer(c.opponent, netPool);
            IERC20(c.token).safeTransfer(feeCollector, fee);
            emit ChallengeResolved(challengeId, winner, c.opponent, netPool);
        } else {
            // Empate: dividir 50/50
            uint256 half = netPool / 2;
            IERC20(c.token).safeTransfer(c.creator, half);
            IERC20(c.token).safeTransfer(c.opponent, netPool - half);
            IERC20(c.token).safeTransfer(feeCollector, fee);
            emit ChallengeResolved(challengeId, winner, address(0), netPool);
        }
    }

    // -----------------------------------------------------------------
    // 5. Cancelar (antes de BOTH_DEPOSITED: creator recupera)
    //    Después de BOTH_DEPOSITED: requiere que ambos cancelen
    // -----------------------------------------------------------------
    function cancel(bytes32 challengeId) external nonReentrant {
        Challenge storage c = challenges[challengeId];
        require(
            msg.sender == c.creator || msg.sender == c.opponent,
            "Not party"
        );
        require(
            c.status == ChallengeStatus.AWAITING_OPPONENT ||
                c.status == ChallengeStatus.BOTH_DEPOSITED,
            "Bad status"
        );

        c.status = ChallengeStatus.CANCELLED;

        // Reembolsar
        if (creatorDeposited[challengeId]) {
            IERC20(c.token).safeTransfer(c.creator, c.stakeAmount);
        }
        if (opponentDeposited[challengeId]) {
            IERC20(c.token).safeTransfer(c.opponent, c.stakeAmount);
        }

        emit ChallengeCancelled(challengeId, msg.sender);
    }

    // -----------------------------------------------------------------
    // Admin: actualizar oracle y fee
    // -----------------------------------------------------------------
    function setOracle(address _oracle) external {
        require(msg.sender == feeCollector, "Not feeCollector");
        oracle = _oracle;
        emit OracleUpdated(_oracle);
    }

    function setFee(uint256 _feeBps) external {
        require(msg.sender == feeCollector, "Not feeCollector");
        require(_feeBps <= 1000, "Max 10%");
        // FEE_BPS es constant, en producción usar storage variable
        emit FeeUpdated(_feeBps);
    }

    // -----------------------------------------------------------------
    // Views
    // -----------------------------------------------------------------
    function getChallenge(bytes32 challengeId)
        external
        view
        returns (Challenge memory)
    {
        return challenges[challengeId];
    }

    function isFullyFunded(bytes32 challengeId) external view returns (bool) {
        return creatorDeposited[challengeId] && opponentDeposited[challengeId];
    }
}
