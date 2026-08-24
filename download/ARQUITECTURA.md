# Arquitectura técnica — NoKYCSwap

## Resumen

NoKYCSwap es una plataforma P2P para compra-venta de criptomonedas **sin KYC**, inspirada en LocalBitcoins (cerrado en febrero 2023) pero con escrow on-chain, multi-chain real, chat cifrado E2E y soporte Tor nativo.

## Stack tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| Frontend | Next.js 16 (App Router) + React 19 | — |
| Lenguaje | TypeScript 5 (strict) | — |
| Estilos | Tailwind CSS 4 + shadcn/ui (New York) | — |
| Estado | Zustand (cliente) + TanStack Query (server) | — |
| Base de datos | SQLite (vía Prisma 6) | desarrollo |
| ORM | Prisma Client | 6.19+ |
| Auth | Pseudónima (sin NextAuth, sin JWT, sin cookies firmadas) | — |
| Cifrado E2E | Web Crypto API (ECDH P-256 + AES-GCM-256) | — |
| Smart contracts | Solidity 0.8.20 + OpenZeppelin | — |
| WebSocket | Socket.io (mini-service separado) | opcional |
| Runtime | Bun (desarrollo) / Node.js (producción) | — |

## Diagrama de componentes

```
┌─────────────────────────────────────────────────────────────┐
│                       NAVEGADOR (Tor)                        │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Next.js SPA (solo ruta /)                          │   │
│  │  ├─ Inicio / Mercado / Crear oferta                 │   │
│  │  ├─ Mis Trades / Billetera / Reputación             │   │
│  │  └─ Disputas / Guía Tor                             │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Zustand store (auth + tab + privateKey)            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Web Crypto API (ECDH P-256, AES-GCM-256)           │   │
│  │  - generateKeyPair()  → clave pública sube al server│   │
│  │  - encryptMessage()   → ciphertext sube al server   │   │
│  │  - decryptMessage()   → solo en cliente              │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS / Tor (.onion)
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    NEXT.JS SERVER (Node)                     │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  API Routes (App Router)                            │   │
│  │  ├─ /api/auth/login        (pseudónimo)             │   │
│  │  ├─ /api/offers            (CRUD ofertas)            │   │
│  │  ├─ /api/trades/[id]       (lifecycle del trade)     │   │
│  │  ├─ /api/trades/[id]/messages (chat cifrado)         │   │
│  │  ├─ /api/reputation        (feedback + score)        │   │
│  │  ├─ /api/disputes          (apertura/resolución)     │   │
│  │  ├─ /api/chain-config      (multi-chain metadata)    │   │
│  │  └─ /api/dashboard         (estadísticas)            │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Prisma Client → SQLite                              │   │
│  │  (users, offers, trades, messages, feedbacks,        │   │
│  │   disputes)                                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              │ RPC
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              BLOCKCHAINS (multi-chain)                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │ Ethereum │  │ Bitcoin  │  │  Tron    │  │  Monero  │    │
│  │ (EVM)    │  │ (UTXO)   │  │ (TRC20)  │  │ (RingCT) │    │
│  │          │  │          │  │          │  │          │    │
│  │ P2PEscrow│  │ HTLC/mult│  │ P2PEscrow│  │ solo     │    │
│  │ .sol     │  │ isig P2SH│  │ .sol TRC │  │ transfer │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Modelo de datos (Prisma)

### User (pseudónimo)
- `alias` — único, público, generado aleatoriamente
- `walletAddress` — única, on-chain, es la identidad
- `publicKey` — clave pública ECDH P-256 para cifrado E2E
- `torOnly` — bandera que exige Tor a las contrapartes
- `reputationScore` — 0-100, recalculado tras cada feedback
- **NO** hay: email, nombre, teléfono, documento, IP persistida

### Offer
- `type` (BUY/SELL), `chain`, `asset`, `amount`, `currency`, `pricePerUnit`
- `paymentMethods` — CSV de IDs de métodos (Nequi, PIX, SEPA, etc.)
- `paymentWindowMin` — tiempo máximo para pago fiat
- `status` (ACTIVE/PAUSED/CLOSED)

### Trade
- Referencia a `offer`, `buyer`, `seller`
- `cryptoAmount`, `fiatAmount`, `pricePerUnit` (congelados al abrir)
- `paymentMethod`, `paymentDetails` (cifrados E2E)
- `escrowAddress`, `escrowTxHash`, `releaseTxHash` (on-chain)
- `status` (PENDING_ESCROW → ESCROW_FUNDED → PAYMENT_SENT → PAYMENT_CONFIRMED → COMPLETED | CANCELLED | DISPUTED)
- Timestamps por etapa para auditoría

### Message
- `tradeId`, `senderId`
- `ciphertext`, `nonce` — el servidor NUNCA ve el plaintext
- El descifrado ocurre solo en el navegador del destinatario

### Feedback
- `tradeId`, `fromUserId`, `toUserId`
- `rating` (1-5), `trustScore` (0-100), `comment`
- Constraint único: un feedback por usuario por trade

### Dispute
- `tradeId`, `openerId`, `defendantId`
- `reason`, `evidence` (URL o hash IPFS)
- `status` (OPEN/RESOLVED_BUYER/RESOLVED_SELLER/CANCELLED)
- `resolution`, `resolvedBy` (alias del árbitro)

## Smart contract de escrow (`P2PEscrow.sol`)

**Ubicación:** `smart-contracts/P2PEscrow.sol`

**Funciones:**

| Función | Quién llama | Cuándo |
|---------|------------|--------|
| `createTrade(tradeId, buyer, arbitrator, token, amount, window, hash)` | Vendedor | Antes de depositar |
| `fundTrade(tradeId)` | Vendedor (envía ETH/tokens) | Para activar el escrow |
| `releaseToBuyer(tradeId)` | Vendedor | Tras confirmar pago fiat |
| `cancel(tradeId)` | Cualquiera | Antes/pre-funding o tras ventana |
| `raiseDispute(tradeId)` | Comprador o vendedor | Cuando hay desacuerdo |
| `resolveDispute(tradeId, winner, reason)` | Árbitro | Tras revisar evidencia |

**Comisión:** 0.25% (25 bps) sobre cada trade completado, enviada a `feeCollector`.

**Seguridad:**
- `ReentrancyGuard` en todas las funciones de pago
- `SafeERC20` para transferencias de tokens
- Time-lock: ventana de pago configurable, cancelable tras expirar
- Sin `selfdestruct`, sin upgradeabilidad (inmutable post-deploy)

**Estado del contrato:** NO AUDITADO. Antes de mainnet con fondos reales, contrate CertiK / OpenZeppelin / Trail of Bits.

## Cifrado E2E

**Implementación:** `src/lib/crypto.ts`

**Flujo:**
1. Al registrar, cada usuario genera un par ECDH P-256 en el navegador (Web Crypto `subtle.generateKey`).
2. La **clave pública** se sube al servidor y se almacena en `User.publicKey`.
3. La **clave privada** se guarda en `localStorage` del navegador. **NUNCA** sale del dispositivo.
4. Para enviar un mensaje, el emisor deriva una clave compartida ECDH entre su clave privada y la pública del destinatario, luego cifra con AES-GCM-256 + IV aleatorio.
5. Solo `ciphertext` y `nonce` viajan al servidor.
6. El destinatario descifra localmente con su clave privada + la pública del emisor.

**Limitaciones del MVP:**
- Usamos P-256 en vez de X25519 (NaCl/libsodium) por compatibilidad nativa con Web Crypto.
- No hay verificación de fingerprint (en producción: mostrar hash de la clave pública para verificación out-of-band).
- No hay perfect forward secrecy (cada mensaje usa la misma clave derivada).

## Multi-chain

| Cadena | Soporte | Escrow | Notas |
|--------|---------|--------|-------|
| Ethereum | ✅ Completo | Smart contract Solidity | ERC20: ETH, USDT, USDC, WBTC |
| Bitcoin | ⚠️ Parcial | HTLC / P2SH multisig | BTC nativo, sin smart contracts |
| Tron | ⚠️ Parcial | Smart contract TRC20 | TRX, USDT TRC20 |
| Monero | ⚠️ Limitado | Solo transferencia | Sin escrow on-chain posible (RingCT opaco) |

**En el MVP:** el smart contract está escrito para Ethereum. Para Bitcoin se usaría HTLC (Hash Time-Locked Contracts). Para Tron, el mismo contrato Solidity se puede deployar (TRON es EVM-compatible). Para Monero, el escrow debe ser off-chain con MULTISIG 2-de-3 vía claves view+spend.

## Privacidad

| Dimensiones | Implementación MVP |
|-------------|-------------------|
| Identidad | Pseudónima (alias + wallet) |
| Comunicación | Tor Browser → Hidden Service .onion |
| Mensajes | Cifrados E2E (ECDH + AES-GCM) |
| Transacciones | On-chain públicas (BTC/ETH) u opacas (XMR) |
| Metadatos | IP solo visible si no usa Tor |
| Logs del server | No se persisten IPs (configurar Caddy/nginx) |

**Niveles de privacidad recomendados** (ver Guía Tor en la app):
1. Básico: alias + wallet generada
2. Medio: + Tor Browser
3. Alto: + Monero (XMR)

## Limitaciones conocidas del MVP

1. **No hay wallet real integrada** — se usa una wallet simulada. En producción: MetaMask, WalletConnect, o CLI.
2. **Smart contract no desplegado** — la dirección es `0x000…`. Tras deployarlo en Sepolia, actualizar `src/lib/blockchain/contracts.ts`.
3. **No hay oráculo de precios** — los precios son fijos o ingresados manualmente. En producción: Chainlink.
4. **Árbitros centralizados** — en producción, considerar Kleros (DAO de arbitraje descentralizado).
5. **No hay SOAP/AML** — por diseño. Esto es lo que lo hace ilegal en muchas jurisdicciones.
6. **SQLite** — solo para desarrollo. En producción: PostgreSQL o MySQL.
7. **Sin WebSocket real** — el chat hace polling cada 3s. En producción: socket.io mini-service (ya estructurado en `mini-services/chat-service/`).
8. **Sin IPFS** — la evidencia de disputas es solo un string. En producción: subir a IPFS y guardar el CID.

## Archivos clave

```
prisma/schema.prisma                    — modelo de datos
smart-contracts/P2PEscrow.sol           — contrato Solidity
smart-contracts/README.md               — guía de despliegue
src/lib/blockchain/config.ts            — chains, tokens, métodos de pago
src/lib/blockchain/contracts.ts         — ABI + dirección del escrow
src/lib/crypto.ts                       — ECDH + AES-GCM
src/lib/store.ts                        — estado global (Zustand)
src/lib/format.ts                       — formateo y helpers
src/app/api/                            — todas las rutas del backend
src/components/marketplace/             — todas las vistas del frontend
src/app/page.tsx                        — orquestador SPA
scripts/seed.ts                         — datos de demostración
```
