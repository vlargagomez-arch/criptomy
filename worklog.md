# CriptoMy — Worklog

---
Task ID: plataforma-web3-latam-completa
Agent: main
Task: Construir plataforma Web3 LATAM todo-en-uno conforme al spec de 20 secciones.

Work Log:
- Arquitectura modular: 7 interfaces de providers definidas (WalletProvider,
  OnRampProvider, OffRampProvider, CardProvider, RemittanceProvider,
  MarketDataProvider, ProviderMetadata)
- Registry central con 18 providers conocidos con metadata completa
  (isReal, isLive, apiKeyRequired, integrationType, countries)
- Adapter MOCK claro (throw en produccion)
- Adapter MoonPay real (espera API key)
- Menu P2P unificado en un solo tab con sub-tabs internos

Nuevas vistas completadas:
1. HomeView dual (landing si no logueado, dashboard si logueado)
2. ComprarView - comparador de on-ramps
3. VenderView - shell para off-ramp
4. EnviarView - transferencia on-chain REAL con MetaMask
5. RecibirView - QR + direccion + warning de red
6. RemesasView - info MoneyGram/Bitso + warning revision legal
7. TarjetaView - providers reales Crypto.com/Wirex/Gnosis Pay
8. MercadoP2PUnifiedView (sub-tabs: explorar, crear, mis-trades, disputas)
9. RetosP2PView (gaming)
10. NFTMarketplaceView (multi-chain)
11. NFTDropsView (calendario)
12. PriceAlertsView (3 tipos: DIP_BELOW, PERCENT_DROP, TARGET_PRICE)
13. OportunidadesView (6 categorias con fuente verificable)
14. ProveedoresView (directorio con filtros)
15. ComparadorView (tabla ordenable)
16. ComplianceView (quien presta/custodia/hace KYC por servicio)
17. AdminView (panel administrativo con 3 tabs)

APIs:
- /api/onramp/compare + /api/onramp POST (con MoonPay adapter)
- /api/providers (lista registry con filtros)
- /api/opportunities (CRUD con admin token)
- /api/notifications, /api/price-alerts, /api/nft, /api/nft-drops
- /api/cron/price-alerts-check (Vercel cron cada 5 min)

Stage Summary:
- 18 vistas funcionando + 25 rutas API
- Build local verificado: 0 errores, 0 simulaciones
- Push a GitHub: commit 400b361 → origin/main
- Vercel webhook sigue sin disparar (mismo problema de antes)
- Pendiente: que el usuario verifique Vercel Dashboard y haga Redeploy manual
  o reconecte el webhook GitHub → Vercel

---
Task ID: unificar-enviar-recibir-btc-search-arbitraje-p2p
Agent: main
Task: 4 cambios solicitados por usuario (wallet, menu unificado, buscador BTC, arbitraje P2P en Earn)

Work Log:
- Nuevo tab 'enviar-recibir' unificado con sub-tabs internos (Enviar | Recibir)
- Migracion v22 del store: redirige tabs viejos (enviar, recibir) al nuevo
- Header + HomeView + page.tsx + DonacionesView actualizados
- Fallback USD→USDT en Bitget, KuCoin, HTX, Bingx (antes no respondian a USD)
- API /api/search ahora devuelve TODOS los providers (online + offline + error)
- SmartSearchView: nueva FullProviderTable con metadata de cada exchange
  (logo, rank, KYC, liquidez, estado visual ONLINE/ERROR/DISABLED)
- Engine de Arbitraje P2P en src/lib/p2p-arbitrage/engine.ts:
  * Combina Binance P2P (BUY + SELL) + Kraken + Bitvavo + Coinbase spot
  * Matching de cantidades: solo muestra pares donde min-max se cruzan
  * Estima ganancia operando el monto maximo del rango matched
- API: GET /api/scanner/p2p-arbitrage?asset=USDT&fiat=COP
- Componente P2PArbitrageView (selector asset/fiat, KPIs, opportunity cards,
  tablas BUY/SELL, auto-refresh 30s)
- Sub-tab 'Arbitraje P2P' dentro de EarnView (junto a DeFi Pools)
- Provider Bitvavo nuevo (exchange holandes, API publica)

Stage Summary:
- Commit fd56cb8 → origin/main
- 18 archivos cambiados, +1387 / -125 lineas
- Build local: 0 errores
- 4 rutas API nuevas visibles en el build: /api/scanner/p2p-arbitrage
- El usuario debe hacer Redeploy manual en Vercel o esperar al webhook
- Wallet del usuario: 0xcbd7e2e271b78e7e7491162aec21b3d38b72e182

---
Task ID: integrar-bitvavo-completo
Agent: main
Task: Integrar Bitvavo como provider completo del scanner (no solo referencia spot)

Work Log:
- Diagnosticado el problema: Bitvavo solo estaba en p2p-arbitrage/engine.ts como
  referencia spot. No aparecia en el buscador principal.
- Creado src/lib/scanner/providers/bitvavo.ts como provider standalone:
  * Endpoint: https://api.bitvavo.com/v2/ticker/24hour?market=BTC-EUR
  * IMPORTANTE: Cloudflare pide User-Agent + Accept: application/json
    (sin esto, devuelve HTML con challenge; con esto, devuelve JSON)
  * Headers agregados a fetchWithCache call
  * Rate limit: 1000 req/min (rate-limit-remaining en response headers)
  * Soporta 12 assets: BTC, ETH, USDT, USDC, SOL, XRP, ADA, AVAX, LINK, DOT, MATIC, DOGE
  * Para USD: usa EUR como fallback con conversion 1.08 (aprox, Sept 2024)
- Registrado en registry.ts con metadata completa (KYC MiCA, DNB Holanda)
- Agregado al engine.ts: 13 providers ahora (antes 12)
- SmartSearchView.tsx actualizado con:
  * exchangeInfo Bitvavo (#25, 'Alta EU', $200M+)
  * exchangeTradeUrls link directo bitvavo.com/en/trade/
  * PROVIDER_META con logo 🟠 y descripcion MiCA
  * '11 exchanges' -> '12 exchanges' en loading state
  * Bitvavo tambien en seccion arbitraje (withdrawFee: EU SEPA gratis)
- p2p-arbitrage/engine.ts: refactorizado para importar fetchBitvavoTicker
  desde scanner/providers/bitvavo.ts (codigo compartido, no duplicado)

Stage Summary:
- Commit a0b1c15 → origin/main
- 9 archivos cambiados, +210 / -126 lineas
- Bitvavo ya aparece en el buscador principal al buscar BTC, ETH, USDT, etc.
- Total providers en el scanner: 13 (Binance, OKX, Bybit-proxy, Kraken, Coinbase,
  KuCoin, Gate, MEXC, HTX, Bitget, BingX, Bitvavo, CoinGecko)
- Build local: 0 errores
- Verified Bitvavo API returns JSON: {"market":"BTC-EUR","price":"68415"}

---
Task ID: arbitraje-p2p-multi-exchange
Agent: main
Task: Integrar TODOS los exchanges P2P (Bybit, OKX, HTX, KuCoin, Bitget, Gate) en arbitraje P2P

Work Log:
- Testeado en sandbox cada API P2P con curl:
  * Bybit: POST api2.bybit.com/fiat/otc/item/online -> ret_code 10001 (params error)
  * OKX: POST /v2/c2c/trading/adv/list -> 404
  * HTX: otc-api.huobi.com -> timeout (endpoint historico ya no existe)
  * KuCoin: POST /_api/p2p/... -> Cloudflare challenge HTML
  * Bitget: GET /api/v2/p2p/merchant/... -> HTML (no JSON)
  * Gate.io: POST /p2p/api/v1/... -> Akamai 403 Access Denied
  * Binance: POST p2p.binance.com/bapi/c2c/... -> 200 OK ✅

- Creado src/lib/p2p-arbitrage/p2p-providers.ts con 7 providers:
  scanBinanceP2P, scanBybitP2P, scanOkxP2P, scanHtxP2P,
  scanKucoinP2P, scanBitgetP2P, scanGateP2P
  Cada uno es defensivo: si falla, retorna status DISABLED + razon
  clara en el campo error.

- Engine.ts refactorizado para matching CROSS-EXCHANGE:
  * Combina BUY offers de TODOS los providers en un array
  * Combina SELL offers de TODOS los providers en otro array
  * Para cada par (BUY_i, SELL_j) detecta si mismo o distinto exchange
  * INTRA: minimo spread 0.5%
  * CROSS: minimo spread 1% (cubre transfer entre exchanges)
  * Mantiene matching de cantidades (interseccion min-max)

- UI P2PArbitrageView actualizada:
  * Nuevo grid 'Exchanges P2P escaneados' con 7 exchanges
  * Cada exchange muestra badge ONLINE / BLOQUEADO + # ofertas + latencia
  * Info explicativa sobre WAF/Cloudflare/Akamai blocking
  * OpportunityCard muestra provider de cada lado + badge INTRA/CROSS
  * OffersTable muestra el provider junto al advertiser
  * Explicacion ampliada con secciones INTRA vs CROSS

- API /api/scanner/p2p-arbitrage ahora devuelve p2pProviders[]
  (antes tenia un 'providers' hardcoded artificial)

Stage Summary:
- Commit b5f2f28 → origin/main
- 4 archivos cambiados, +796 / -110 lineas
- Build local: 0 errores
- Realidad honesta: la mayoría de P2P APIs bloquean Vercel server-side.
  Binance P2P es el unico confiable. Mostramos el status real de cada
  exchange para que el usuario sepa por que algunos no responden.
- Si en el futuro Bybit/OKX/etc. abren su API publica, ya tenemos
  la integracion lista (solo habra que ajustar el payload).

---
Task ID: bybit-p2p-funciona-form-urlencoded
Agent: main
Task: Hacer funcionar Bybit P2P (y OKX si es posible) — busque alternativas

Work Log:
- Diagnosticado el problema: Bybit devolvía ret_code 10001 'param error'
  con JSON. Probé 6+ variantes de payload — todas fallaban.
- TRUCO ENCONTRADO: Bybit rechaza application/json. Hay que usar
  application/x-www-form-urlencoded;charset=UTF-8.
- Verificado con curl desde server: 51 offers para USDT/COP.
- Verificado con script Node: ret_code 0, count 51, primer item real
  (sebastiancarv54, COP 3127.00, min 30000, max 3000000).
- Cambios en src/lib/p2p-arbitrage/p2p-providers.ts:
  * Nuevo helper fetchP2PForm() con browser-like headers
    (User-Agent Chrome 120, Origin bybit.com, Referer bybit.com)
  * scanBybitP2P ahora usa fetchP2PForm (NO JSON)
  * Mapeo corregido: nickName (no nickname), lastQuantity,
    paymentName+paymentID, recentOrderNum, recentExecuteRate
  * Mensajes DISABLED actualizados con pruebas reales (OKX: 6+ paths
    probados, todos 404/Method Not Allowed. Requiere CSRF cookie.)

- Para OKX: probé exhaustivamente 6+ paths y 2 content-types
  (JSON + form-urlencoded). Todos: 404 / Method Not Allowed.
  La web de OKX usa sesión+CSRF que solo se obtiene del navegador,
  no desde server. Realmente no hay API pública.

- Para HTX (Huobi): endpoint histórico ya no responde (timeout).
  El nuevo requiere auth.

- Para KuCoin/Bitget/Gate: bloqueados por WAF/Akamai desde server.

ESTADO FINAL DE PROVIDERS P2P:
- ✅ Binance P2P: 20+ offers (USDT/COP)
- ✅ Bybit P2P: 51 offers (USDT/COP) — ¡NUEVO! Funciona.
- ⚠️ OKX, HTX, KuCoin, Bitget, Gate: bloqueados desde server
  (todos probados con varios paths y content-types)

El arbitraje cross-exchange entre Binance y Bybit ahora será posible.
Estos son los 2 exchanges P2P más grandes del mundo en conjunto.

Stage Summary:
- Commit 7020f36 → origin/main
- 2 archivos cambiados, +166 / -69 lineas
- Script test-bybit-p2p.mjs persistido para futuras pruebas
- Build local: 0 errores
