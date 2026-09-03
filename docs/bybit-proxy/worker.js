// Cloudflare Worker: Bybit API Proxy
// Pega este código en el editor del Worker en Cloudflare Dashboard.

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const targetPath = url.pathname;
    const targetQuery = url.search;
    const targetUrl = `https://api.bybit.com${targetPath}${targetQuery}`;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cf-connecting-ip');
    headers.delete('cf-ipcountry');
    headers.delete('cf-ray');
    headers.delete('cf-visitor');
    headers.set('Accept', 'application/json');
    headers.set('User-Agent', 'Mozilla/5.0 (compatible; CriptoMy/1.0)');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      });

      const newHeaders = new Headers(response.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => newHeaders.set(k, v));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: err.message }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }
  }
};
