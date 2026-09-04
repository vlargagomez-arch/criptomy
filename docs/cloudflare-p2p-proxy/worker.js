// ============================================================
// Cloudflare Worker: CriptoMy P2P Multi-Exchange Proxy
// ============================================================
// Pega este código en el editor del Worker en Cloudflare Dashboard.
// Es gratis y toma 5 minutos configurarlo.
//
// ¿Para qué sirve?
// Los exchanges P2P (MEXC, KuCoin, Bitget, Gate.io, HTX) bloquean
// las llamadas desde servidores cloud (Vercel, AWS) con WAF/Akamai.
// Este proxy enruta las llamadas a través de la red de Cloudflare
// (cuyas IPs NO están bloqueadas), permitiendo acceder a las APIs.
//
// Una vez configurado, pega la URL del Worker en la env var
// P2P_PROXY_URL de tu deployment de Vercel y todos los providers
// P2P se activarán automáticamente.
// ============================================================

// Lista de dominios permitidos (seguridad: solo estos se pueden proxear)
const ALLOWED_HOSTS = [
  "api2.bybit.com",
  "www.okx.com",
  "www.kucoin.com",
  "api.kucoin.com",
  "www.mexc.com",
  "api.mexc.com",
  "www.bitget.com",
  "api.bitget.com",
  "www.gate.io",
  "api.gateio.ws",
  "otc-api.huobi.com",
  "otc-api.huobi.pro",
  "c2c-api.htx.com",
  "c2c-api.huobi.com",
  "api.huobi.pro",
];

// Mapeo de prefijos de path a hosts destino
const PATH_TO_HOST = {
  "/bybit/": "api2.bybit.com",
  "/okx/": "www.okx.com",
  "/kucoin/": "www.kucoin.com",
  "/kucoin-api/": "api.kucoin.com",
  "/mexc/": "www.mexc.com",
  "/mexc-api/": "api.mexc.com",
  "/bitget/": "www.bitget.com",
  "/bitget-api/": "api.bitget.com",
  "/gate/": "www.gate.io",
  "/gate-api/": "api.gateio.ws",
  "/htx/": "otc-api.huobi.com",
  "/htx-pro/": "otc-api.huobi.pro",
  "/htx-c2c/": "c2c-api.htx.com",
  "/huobi/": "api.huobi.pro",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, KEY, SIGN, Timestamp, X-API-KEY, X-App-Version, OK-ACCESS-KEY, OK-ACCESS-SIGN, OK-ACCESS-PASSPHRASE, OK-ACCESS-TIMESTAMP",
  "Access-Control-Max-Age": "86400",
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (path === "/" || path === "/health") {
      return new Response(JSON.stringify({
        ok: true,
        service: "criptomy-p2p-proxy",
        version: "1.0.0",
        routes: Object.keys(PATH_TO_HOST),
      }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Buscar el host destino según el prefijo del path
    let targetHost = null;
    let targetPath = path;
    for (const [prefix, host] of Object.entries(PATH_TO_HOST)) {
      if (path.startsWith(prefix)) {
        targetHost = host;
        targetPath = path.slice(prefix.length - 1); // mantener el /
        break;
      }
    }

    if (!targetHost || !ALLOWED_HOSTS.includes(targetHost)) {
      return new Response(JSON.stringify({
        error: "Host no soportado",
        path,
        hint: "Usa uno de los prefijos: " + Object.keys(PATH_TO_HOST).join(", "),
      }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Construir URL destino
    const targetUrl = `https://${targetHost}${targetPath}${url.search}`;

    // Headers: copiar del request original, limpiar headers de Cloudflare
    const headers = new Headers(request.headers);
    headers.delete("host");
    headers.delete("cf-connecting-ip");
    headers.delete("cf-ipcountry");
    headers.delete("cf-ray");
    headers.delete("cf-visitor");
    headers.delete("x-forwarded-for");
    headers.delete("x-forwarded-proto");
    headers.delete("x-real-ip");

    // Asegurar User-Agent legítimo (algunos exchanges rechazan UA vacío o default)
    if (!headers.get("User-Agent") || headers.get("User-Agent").includes("cloudflare")) {
      headers.set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
    }
    headers.set("Accept", "application/json, text/plain, */*");

    try {
      // Forward the request — body solo si no es GET/HEAD
      const init = {
        method: request.method,
        headers,
      };
      if (!["GET", "HEAD"].includes(request.method)) {
        init.body = await request.text();
      }

      const response = await fetch(targetUrl, init);

      // Copiar respuesta con CORS headers
      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => {
        if (k !== "Access-Control-Max-Age") newHeaders.set(k, v);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({
          error: "Error al contactar el exchange",
          message: err.message,
          targetUrl,
        }),
        {
          status: 502,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }
  }
};
