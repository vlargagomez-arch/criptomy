# Cloudflare Worker: Proxy para Bybit API

Bybit bloquea IPs de cloud providers (incluido Vercel) con HTTP 403:
```
"The Amazon CloudFront distribution is configured to block access from your country"
```

Este Worker proxy salta el bloqueo porque Cloudflare Workers se ejecutan
en una red global edge (~300 locations) que Bybit no bloquea.

## Configuración (gratis, 5 minutos)

### 1. Crear cuenta en Cloudflare
- Ve a https://dash.cloudflare.com/sign-up
- Crea una cuenta gratuita (no necesitas dominio)

### 2. Crear un Worker
- En el dashboard: **Workers & Pages → Create application → Create Worker**
- Nombre: `bybit-proxy`
- Click "Deploy"

### 3. Editar el código
- Click "Edit code"
- Pega el contenido de `worker.js` (en esta carpeta)
- Click "Deploy"

### 4. Copiar la URL del Worker
- Será algo como: `https://bybit-proxy.tu-usuario.workers.dev`

### 5. Configurar env var en Vercel
- Vercel → Settings → Environment Variables
- Nombre: `BYBIT_PROXY_URL`
- Valor: la URL del Worker (con `https://`)
- Redeploy

### 6. Cambiar flag en el código
- En `src/lib/scanner/engine.ts`, cambiar `ENABLE_BYBIT = false` a `true`
- Commit + push

## Verificación

Después del deploy:
```bash
curl "https://tu-app.vercel.app/api/scanner/providers"
```

Bybit debe aparecer como **ONLINE** con ~150-250ms de latencia (incluye hop via Cloudflare).

## Límites
- Cloudflare Workers (tier gratis): 100,000 requests/día.
- Latencia extra: ~50-100ms (Worker → Bybit)
- Para uso normal del Buscador Web3 (cada 15s cache), esto es suficiente:
  100k req/día = ~4166 req/hora = ~70 req/min, mucho más de lo necesario.
