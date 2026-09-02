# CriptoMy — Worklog

---
Task ID: cleanup-final
Agent: main
Task: Limpiar todo lo simulado/no funcional. Dejar SOLO Mercado P2P + Retos P2P + Billetera + Reputacion. Todo 100% real.

Work Log:
- Eliminados 6 componentes huérfanos: SwapView, LightningView, P2PView, DeployContractView, DisputesView, TorGuideView
- Eliminadas 5 APIs huérfanas: /api/lightning, /api/uniswap, /api/kleros, /api/escrow-config, /api/chain-config
- Eliminadas 7 libs huérfanas: lightning.ts, kleros.ts, uniswap.ts, p2p.ts, ipfs.ts, bitcoin-electrum.ts, challenge-escrow.ts
- Arreglada API /api/ipfs: ahora acepta FormData (file upload real) además de JSON. Es honesta: si no hay PINATA_API_KEY, devuelve CID local con warning claro "no persistente"
- Build verificado localmente: 16 rutas dinámicas, todas reales, 0 simuladas
- Push a GitHub: commit 9b3de4e → main → https://github.com/vlargagomez-arch/criptomy
- Vercel responde HTTP 200 OK en https://criptomy.vercel.app/

Stage Summary:
- Header simplificado a: Inicio, Mercado, Crear oferta, Mis trades, Retos, Billetera, Reputación
- Store (Zustand v10): solo 7 tabs válidos
- APIs restantes: auth/login, balance, bitcoin, challenges, challenges/[id], cleanup, dashboard, disputes, games/link, ipfs, offers, payouts, price, reputation, trades, trades/[id], trades/[id]/messages — todas 100% reales
- Sin simulaciones: no Lightning mock, no Uniswap falso, no libp2p, no Kleros, no escrow simulado
- Lo único "opcional" es IPFS: si el usuario configura PINATA_API_KEY, los screenshots se suben a IPFS real; si no, se genera un CID local con warning honesto

---
Task ID: features-notifications-nft-alerts
Agent: main
Task: Como firma de consultoría, agregar 4 funcionalidades nuevas 100% reales (sin simulaciones):
1. Sistema de Notificaciones (in-app + browser push)
2. Alertas de Precio "buy the dip"
3. Mercado NFT multi-chain (Polygon + Base + Ethereum)
4. Calendario de NFT Drops

Work Log:
- Prisma schema: 4 nuevos modelos (Notification, PushSubscription, PriceAlert, NFTListing, NFTDrop) + relaciones en User
- Generadas VAPID keys (scripts/generate-vapid-keys.ts) — agregadas a .env
- Instalado web-push npm package
- Creada lib src/lib/notify.ts con helpers: notifyUser, notifyPriceTargetMatches, notifyNewOfferPaymentMethod, notifyTradeUpdate, notifyNewChallenge, notifyDipAlert, notifyNFTSold, notifyNFTBought
- APIs nuevas:
  * /api/notifications (GET, POST mark-read, POST delete)
  * /api/notifications/subscribe (POST Web Push subscription, DELETE)
  * /api/price-alerts (GET, POST, DELETE)
  * /api/nft (GET, POST create/buy/delist)
  * /api/nft-drops (GET, POST admin)
  * /api/cron/price-alerts-check (GET, cron cada 5 min)
- Modificadas APIs existentes para disparar notifs:
  * /api/offers POST → notifyPriceTargetMatches + notifyNewOfferPaymentMethod
  * /api/challenges POST → notifyNewChallenge
- Service Worker /public/sw.js para recibir browser push
- Hook useNotifications (src/lib/use-notifications.ts) con polling 30s + suscripción push
- Componentes nuevos:
  * NotificationBell (campana con badge + dropdown)
  * NFTMarketplaceView (grid + filtros chain + Mint+List dialog + Buy dialog)
  * NFTDropsView (calendario con auto-status LIVE/ENDED)
  * PriceAlertsView (crear/listar alertas BTC/ETH/LINK/USDT/USDC)
- Header actualizado con campana + 3 tabs nuevos (NFT, Drops, Alertas)
- Store Zustand v11 con tabs: inicio, mercado, crear, trades, retos, nft, drops, alertas, billetera, reputacion
- Layout actualizado con registro de service worker + metadata a CriptoMy
- vercel.json con cron job cada 5 min para /api/cron/price-alerts-check
- Build verificado: 22 rutas dinámicas, todas reales, 0 errores
- Push a GitHub: commit f436358 → main

Stage Summary:
- 4 features nuevas 100% reales, sin simulaciones
- Notificaciones: in-app SIEMPRE + browser push opcional (usuario activa con 1 click)
- Alertas de precio: 3 tipos (DIP_BELOW, PERCENT_DROP, TARGET_PRICE) + cron job verifica cada 5 min
- NFT Marketplace: mint+list en 3 chains, pago en ETH/USDT/USDC/MATIC, flujo P2P sin escrow
- NFT Drops: calendario curado manualmente (DROPS_ADMIN_TOKEN), auto-status LIVE/ENDED
- Vercel responde HTTP 200 OK después del deploy
- Pendiente: configurar env vars en Vercel (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_SUBJECT, CRON_SECRET, DROPS_ADMIN_TOKEN) + ejecutar prisma db push contra Supabase
