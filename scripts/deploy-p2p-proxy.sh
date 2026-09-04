#!/usr/bin/env bash
# ============================================================
# Deploy automático del Cloudflare Worker proxy para P2P
# ============================================================
# Uso: bash scripts/deploy-p2p-proxy.sh
#
# Esto hace TODO por ti:
# 1. Verifica que wrangler esté instalado
# 2. Te pide login de Cloudflare (1 click en el navegador)
# 3. Despliega el Worker a tu cuenta de Cloudflare (gratis)
# 4. Te da la URL final para poner en Vercel como P2P_PROXY_URL
#
# Total: 5 minutos, sin tocar código.
# ============================================================

set -e

cd "$(dirname "$0")/.."
WORKER_DIR="docs/cloudflare-p2p-proxy"

echo "🚀 Deploy del Cloudflare Worker proxy para P2P"
echo ""
echo "Este script hace TODO por ti. Solo necesitas una cuenta de Cloudflare (gratis)."
echo ""

# 1. Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Necesitas Node.js instalado. Descárgalo de https://nodejs.org"
  exit 1
fi

# 2. Instalar wrangler si no está
if ! command -v wrangler &> /dev/null; then
  echo "📦 Instalando wrangler (CLI de Cloudflare Workers)..."
  npm install -g wrangler
fi

echo ""
echo "📋 Asegúrate de tener una cuenta de Cloudflare (gratis en https://dash.cloudflare.com)"
echo ""
echo "🔑 Abriendo navegador para login de Cloudflare..."
echo "   (Si no abre automáticamente, copia la URL que aparece)"
echo ""

cd "$WORKER_DIR"

# 3. Login (abre navegador)
wrangler login

# 4. Deploy
echo ""
echo "🚀 Desplegando Worker..."
wrangler deploy

echo ""
echo "✅ Worker desplegado!"
echo ""
echo "📝 Copia la URL del Worker (algo como https://criptomy-p2p-proxy.<tu-cuenta>.workers.dev)"
echo ""
echo "Ahora ve a Vercel:"
echo "  1. https://vercel.com/[tu-proyecto]/settings/environment-variables"
echo "  2. Agrega nueva variable:"
echo "     Name: P2P_PROXY_URL"
echo "     Value: <pega la URL del Worker aquí>"
echo "  3. Save"
echo "  4. Redeploy el proyecto (Deployments → click en los ... → Redeploy)"
echo ""
echo "✨ Listo! Después del redeploy, TODOS los exchanges P2P (OKX, MEXC, KuCoin, Bitget, Gate.io, HTX)"
echo "    aparecerán como 🟢 ONLINE en la sección Earn → Arbitraje P2P."
