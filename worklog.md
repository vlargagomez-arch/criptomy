# CriptoMy — Worklog

---
Task ID: features-notifications-nft-alerts
Agent: main
Task: Como firma de consultoría, agregar 4 funcionalidades nuevas 100% reales (sin simulaciones):
1. Sistema de Notificaciones (in-app + browser push)
2. Alertas de Precio "buy the dip"
3. Mercado NFT multi-chain (Polygon + Base + Ethereum)
4. Calendario de NFT Drops

Stage Summary:
- 4 features nuevas 100% reales, sin simulaciones
- Notificaciones: in-app SIEMPRE + browser push opcional (usuario activa con 1 click)
- Alertas de precio: 3 tipos (DIP_BELOW, PERCENT_DROP, TARGET_PRICE) + cron job verifica cada 5 min
- NFT Marketplace: mint+list en 3 chains, pago en ETH/USDT/USDC/MATIC, flujo P2P sin escrow
- NFT Drops: calendario curado manualmente (DROPS_ADMIN_TOKEN), auto-status LIVE/ENDED
- Build verificado: 22 rutas dinámicas, todas reales, 0 errores
- Push a GitHub: commit f436358 → main

---
Task ID: plataforma-web3-latam-arquitectura
Agent: main
Task: Construir plataforma Web3 LATAM todo-en-uno (sin ser banco, sin custodia).
Incluir: billetera, on-ramp, off-ramp, envío, recepción, P2P, NFT, oportunidades, comparador.
Fusionar menú P2P en UN solo menú. Actualizar GitHub y Vercel.

Work Log:
- Definidas 7 interfaces de providers en src/lib/providers/types.ts:
  WalletProvider, OnRampProvider, OffRampProvider, CardProvider,
  RemittanceProvider, MarketDataProvider, ProviderMetadata
- Registry central con 18 providers conocidos (PROVIDER_REGISTRY):
  MetaMask, WalletConnect, Trust, Rabby, MoonPay, Transak, Ramp,
  Coinbase Onramp, MoonPay Sell, Transak Sell, Crypto.com Card,
  Wirex, Gnosis Pay, MoneyGram, Bitso, Chainlink, CoinGecko
  Cada uno con isReal/isLive/apiKeyRequired para distinguir real de MOCK
- Adapter MOCK claro (onramp/mock.ts): solo desarrollo, throw en producción
- Adapter MoonPay real (onramp/moonpay.ts): listo para cuando se agregue API key
- Prisma schema: modelos Opportunity, SavedOpportunity, ProviderReview
- APIs nuevas: /api/onramp (compare + start), /api/providers, /api/opportunities
- Menu P2P unificado: MercadoP2PUnifiedView con sub-tabs (explorar, crear, mis-trades, disputas)
- Store Zustand v12 con tabs: dashboard, comprar, vender, enviar, recibir,
  mercado-p2p, retos, nft, drops, alertas, oportunidades, proveedores,
  comparador, billetera, reputacion
- Nuevas vistas:
  * HomeView dual: landing si no logueado, dashboard si logueado
  * ComprarView: comparador de on-ramps con filtros país+crypto+red
  * VenderView: shell listo para off-ramp real
  * EnviarView: transferencia on-chain REAL con MetaMask (ETH/MATIC/BNB + USDT/USDC)
  * RecibirView: QR + dirección + warning de red (qrcode.react)
  * OportunidadesView: 6 categorías (LEARN_EARN, AIRDROP, JOB_WEB3, CREATE, MINING, STAKING)
  * ProveedoresView: directorio con filtros categoría + país
  * ComparadorView: tabla comparativa ordenable por fee/KYC
- Header rediseñado con secciones: Inicio, Operaciones, Mercado, Descubrir
- Build local verificado: 25 rutas dinámicas, 0 errores
- build.sh robusto: maneja DATABASE_URL faltante en Vercel
- Push a GitHub: commit 1a1026c → main
- Trigger redeploy con commit vacío para forzar webhook Vercel

Stage Summary:
- Arquitectura modular lista: cambiar adapter = cambiar provider sin tocar UI
- 14 módulos funcionando en UI (incluyendo todos los del spec MVP Fase 1)
- Marketplace P2P fusionado en un solo menú con sub-tabs
- Adapter MOCK claramente identificado, no se ejecuta en producción
- Pendiente: Vercel no está disparando el deploy automáticamente (webhook GitHub roto)
- El usuario debe verificar manualmente en Vercel Dashboard → Deployments
