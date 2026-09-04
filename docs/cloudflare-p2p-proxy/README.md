# Cloudflare Worker P2P Proxy — Guía paso a paso

## ¿Por qué necesitas esto?

Los exchanges P2P (MEXC, KuCoin, Bitget, Gate.io, HTX, OKX) bloquean las llamadas HTTP desde servidores cloud (Vercel, AWS, GCP) usando WAF/Cloudflare/Akamai. Por eso en el panel de arbitraje P2P aparecen como "🔴 BLOQUEADO".

**Cloudflare Workers corren en la red de Cloudflare** (no en Vercel), y sus IPs NO están bloqueadas por los WAF de los exchanges. Enrutar las llamadas a través de un Worker es la solución definitiva.

Es **gratis** (100k requests/día gratis, más que suficiente para uso personal).

## Configuración en 5 minutos

### Paso 1: Crear el Worker

1. Ve a https://dash.cloudflare.com y regístrate/inicia sesión (gratis)
2. En el menú izquierdo, click en **Workers & Pages**
3. Click en **Create application** → **Create Worker**
4. Dale nombre: `criptomy-p2p-proxy`
5. Click en **Deploy**
6. Click en **Edit code**
7. Borra el código de ejemplo y **pega el contenido de `worker.js`** (de esta misma carpeta)
8. Click en **Save and deploy**
9. Te dan una URL como `https://criptomy-p2p-proxy.tu-subdominio.workers.dev` — cópiala

### Paso 2: Configurar la env var en Vercel

1. Ve a tu proyecto en https://vercel.com
2. Settings → Environment Variables
3. Agrega:
   - **Name**: `P2P_PROXY_URL`
   - **Value**: `https://criptomy-p2p-proxy.tu-subdominio.workers.dev` (sin `/` al final)
4. Click en **Save**
5. Redeploya tu proyecto (Deployments → click en los `...` → Redeploy)

### Paso 3: Verificar

Después del redeploy, entra a la sección **Earn → Arbitraje P2P**. Deberías ver:
- 🟢 **Binance P2P** — ONLINE (vía server, sin proxy)
- 🟢 **Bybit P2P** — ONLINE (vía server, sin proxy)
- 🟢 **MEXC P2P** — ONLINE (vía Cloudflare Worker proxy) ← antes BLOQUEADO
- 🟢 **KuCoin P2P** — ONLINE (vía Cloudflare Worker proxy) ← antes BLOQUEADO
- 🟢 **Bitget P2P** — ONLINE (vía Cloudflare Worker proxy) ← antes BLOQUEADO
- 🟢 **Gate.io P2P** — ONLINE (vía Cloudflare Worker proxy) ← antes BLOQUEADO
- 🟢 **HTX P2P** — ONLINE (vía Cloudflare Worker proxy) ← antes BLOQUEADO
- 🟢 **OKX P2P** — ONLINE (vía Cloudflare Worker proxy) ← antes BLOQUEADO

Total: **8 exchanges P2P online** — el mercado más completo de LATAM.

## ¿Cómo funciona el proxy?

El Worker expone rutas con prefijo:

| Prefijo | Exchange | URL destino |
|---------|----------|------------|
| `/bybit/` | Bybit P2P | `https://api2.bybit.com/` |
| `/okx/` | OKX P2P | `https://www.okx.com/` |
| `/kucoin/` | KuCoin P2P | `https://www.kucoin.com/` |
| `/mexc/` | MEXC P2P | `https://www.mexc.com/` |
| `/bitget/` | Bitget P2P | `https://www.bitget.com/` |
| `/gate/` | Gate.io P2P web | `https://www.gate.io/` |
| `/gate-api/` | Gate.io API v4 | `https://api.gateio.ws/` |
| `/htx/` | HTX (Huobi) | `https://otc-api.huobi.com/` |

Ejemplo: si el worker está en `https://criptomy-p2p-proxy.foo.workers.dev`, y quieres llamar a `https://www.mexc.com/api/p2p/online/list`, haces la llamada a:

```
https://criptomy-p2p-proxy.foo.workers.dev/mexc/api/p2p/online/list
```

El Worker:
1. Elimina headers de Cloudflare (cf-ray, cf-connecting-ip, etc.) que delatan el proxy
2. Reescribe el User-Agent a uno de navegador real
3. Hace fetch al exchange desde la red de Cloudflare
4. Devuelve la respuesta con CORS headers para que la app la pueda leer desde el navegador

## Verificar que el Worker funciona

Una vez deployado, prueba en tu navegador:

```
https://criptomy-p2p-proxy.tu-subdominio.workers.dev/health
```

Debe responder:

```json
{
  "ok": true,
  "service": "criptomy-p2p-proxy",
  "version": "1.0.0",
  "routes": ["/bybit/", "/okx/", "/kucoin/", "/mexc/", "/bitget/", "/gate/", "/gate-api/", "/htx/", "/htx-pro/", "/htx-c2c/", "/huobi/"]
}
```

## Alternativas

Si no quieres usar Cloudflare Worker:

### Opción A: Client-side fetch (sin proxy)
La app ya incluye un botón **"Escanear desde mi navegador"** que hace fetch directo desde tu IP residencial (que no está bloqueada). Funciona, pero requiere que visites el sitio del exchange primero en otra pestaña para setear cookies.

### Opción B: Gate.io con API key del usuario
Gate.io tiene API v4 P2P pública que requiere API key + HMAC-SHA512. La app soporta pegar tus credenciales (no las enviamos a ningún server, firmamos localmente).

## Costo

- Cloudflare Workers plan gratis: **100,000 requests por día** — más que suficiente para uso personal.
- Latencia: ~50-200ms extra por request (aceptable para arbitraje P2P que no es HFT).

## Solución de problemas

**Error "Host no soportado"**: Revisa que el prefijo del path sea correcto. Los prefijos válidos están en `/health`.

**Error 502**: El exchange está caído o su WAF bloquea incluso el Worker. Reporta el issue.

**El Worker responde pero la app muestra BLOQUEADO**: Verifica que la env var `P2P_PROXY_URL` esté correctamente configurada en Vercel y que hayas redeployado.

**Latencia muy alta**: Cloudflare Workers pueden tener cold starts de ~100ms. La app cachea respuestas 15s para reducir llamadas.
