# Smart Contracts - P2P Crypto Escrow

Este directorio contiene el contrato Solidity que implementa el escrow on-chain.

## Archivos

- `P2PEscrow.sol` - Contrato principal de escrow

## Despliegue

Requisitos:
- Node.js 20+
- Hardhat
- ETH en Sepolia testnet (obtener en un faucet como sepoliafaucet.com)

Pasos:
```bash
npm init -y
npm install --save-dev hardhat @openzeppelin/contracts @nomicfoundation/hardhat-toolbox
npx hardhat init
# Copiar P2PEscrow.sol a contracts/
# Configurar hardhat.config.js con RED_PRIVADA_SEPOLIA
npx hardhat compile
npx hardhat run scripts/deploy.js --network sepolia
```

Una vez desplegado, anotar la dirección del contrato y configurarla en
`src/lib/blockchain/contracts.ts`.

## Flujo del contrato

1. **createTrade** - El vendedor registra el trade (sin depositar todavía).
2. **fundTrade** - El vendedor deposita los criptoactivos en escrow.
3. **releaseToBuyer** - El vendedor libera los fondos al comprador tras
   recibir el pago fiat fuera de cadena.
4. **cancel** - Cualquiera puede cancelar antes del funding. Tras el funding,
   solo el vendedor puede cancelar, o cualquiera tras expirar la ventana.
5. **raiseDispute** - Cualquiera de las partes puede abrir disputa.
6. **resolveDispute** - El árbitro designado resuelve a favor de una parte.

## Comisión

El contrato cobra 0.25% (25 bps) sobre cada trade completado. Esta comisión
se envía a `feeCollector`. Para modificarla, cambiar `ESCROW_FEE_BPS`.

## Auditoría

**Antes de usar en mainnet con fondos reales**, contrate una auditoría
profesional (CertiK, OpenZeppelin, Trail of Bits, etc.). Este contrato no
ha sido auditado y se provee "tal cual" para fines educativos y de MVP.
