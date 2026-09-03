// ============================================================
// MARKET INTELLIGENCE — Datos de mercado adicionales
// ============================================================
// - Gas price Ethereum (RPC directo, sin API key)
// - Fear & Greed Index (alternative.me, sin API key)
// - Trending coins (CoinGecko, sin API key)
// - Histórico 7d de precios (CoinGecko, sin API key)
// Todos los endpoints son públicos y oficiales.
// ============================================================

import { fetchWithCache } from "./cache";

// ============================================================
// GAS PRICE — Ethereum (vía RPC público)
// ============================================================
// eth_gasPrice devuelve el precio actual sugerido en wei.
// Convertimos a Gwei (1 Gwei = 1e9 wei).
// No incluye EIP-1559 priority fee; es una estimación rápida.

export interface GasInfo {
  gasPriceWei: string; // serializado como string (BigInt no se puede JSON.stringify)
  gasPriceGwei: number;
  estimatedCostUsd?: number; // costo estimado de una transferencia simple (21000 gas)
  ethPriceUsd?: number;
  timestamp: number;
  latencyMs: number;
  status: "ONLINE" | "ERROR";
  error?: string;
}

export async function fetchEthGasPrice(): Promise<GasInfo> {
  const start = Date.now();
  try {
    const res = await fetch("https://ethereum.publicnode.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_gasPrice",
        params: [],
        id: 1,
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) {
      return { gasPriceWei: "0", gasPriceGwei: 0, timestamp: Date.now(), latencyMs: Date.now() - start, status: "ERROR", error: `HTTP ${res.status}` };
    }
    const data = (await res.json()) as { result?: string };
    if (!data.result) {
      return { gasPriceWei: "0", gasPriceGwei: 0, timestamp: Date.now(), latencyMs: Date.now() - start, status: "ERROR", error: "Sin resultado" };
    }
    const gasPriceWei = BigInt(data.result);
    const gasPriceGwei = Number(gasPriceWei) / 1e9;

    // Estimar costo de transferencia simple (21000 gas) si tenemos precio ETH
    let ethPriceUsd: number | undefined;
    let estimatedCostUsd: number | undefined;
    try {
      const ethQuote = await import("./providers/coingecko").then((m) => m.fetchCoingeckoTicker("ETH", "USD"));
      if (ethQuote.status === "ONLINE" && ethQuote.lastPrice > 0) {
        ethPriceUsd = ethQuote.lastPrice;
        const costEth = (gasPriceGwei * 21000) / 1e9; // ETH
        estimatedCostUsd = costEth * ethPriceUsd;
      }
    } catch {
      // ignore
    }

    return {
      gasPriceWei: gasPriceWei.toString(), // Serializar como string (BigInt no se puede JSON.stringify)
      gasPriceGwei,
      estimatedCostUsd,
      ethPriceUsd,
      timestamp: Date.now(),
      latencyMs: Date.now() - start,
      status: "ONLINE",
    };
  } catch (err) {
    return { gasPriceWei: "0", gasPriceGwei: 0, timestamp: Date.now(), latencyMs: Date.now() - start, status: "ERROR", error: (err as Error).message };
  }
}

// ============================================================
// FEAR & GREED INDEX (alternative.me — sin API key)
// ============================================================
// Docs: https://alternative.me/crypto/fear-and-greed-index/
// GET https://api.alternative.me/fng/?limit=1
// Value: 0-100 (0=Extreme Fear, 100=Extreme Greed)

export interface FearGreedInfo {
  value: number;
  classification: string;
  timestamp: number;
  status: "ONLINE" | "ERROR";
  error?: string;
}

interface FearGreedResponse {
  data: { value: string; value_classification: string; timestamp: string }[];
  metadata: { error: string | null };
}

export async function fetchFearGreedIndex(): Promise<FearGreedInfo> {
  const url = "https://api.alternative.me/fng/?limit=1";
  const { data } = await fetchWithCache<FearGreedResponse>(url, {
    provider: "fear-greed",
    ttlMs: 5 * 60 * 1000, // 5 min
    cacheKey: "fear-greed:latest",
  });
  if (!data || !data.data || data.data.length === 0) {
    return { value: 0, classification: "N/A", timestamp: Date.now(), status: "ERROR", error: "Sin datos" };
  }
  return {
    value: parseInt(data.data[0].value),
    classification: data.data[0].value_classification,
    timestamp: parseInt(data.data[0].timestamp) * 1000,
    status: "ONLINE",
  };
}

// ============================================================
// TRENDING COINS (CoinGecko — sin API key)
// ============================================================
// Top monedas más buscadas en CoinGecko en las últimas 24h.
export interface TrendingCoin {
  id: string;
  name: string;
  symbol: string;
  marketCapRank?: number;
  thumb: string;
  priceBtc: number;
  priceUsd?: number;
  priceChangePercent24h?: number;
}

interface CoingeckoTrendingResponse {
  coins: {
    item: {
      id: string;
      coin_id: number;
      name: string;
      symbol: string;
      market_cap_rank: number;
      thumb: string;
      small: string;
      large: string;
      slug: string;
      price_btc: number;
      score: number;
      data?: {
        price: number;
        price_btc: string;
        price_change_percentage_24h: { usd: number };
        market_cap: string;
        total_volume: string;
        sparkline: string;
      };
    };
  }[];
}

export async function fetchTrendingCoins(): Promise<TrendingCoin[]> {
  const url = "https://api.coingecko.com/api/v3/search/trending";
  const { data } = await fetchWithCache<CoingeckoTrendingResponse>(url, {
    provider: "coingecko",
    ttlMs: 5 * 60 * 1000,
    cacheKey: "coingecko:trending",
  });
  if (!data || !data.coins) return [];
  return data.coins.slice(0, 7).map((c) => ({
    id: c.item.id,
    name: c.item.name,
    symbol: c.item.symbol,
    marketCapRank: c.item.market_cap_rank,
    thumb: c.item.thumb,
    priceBtc: c.item.price_btc,
    priceUsd: c.item.data?.price,
    priceChangePercent24h: c.item.data?.price_change_percentage_24h?.usd,
  }));
}

// ============================================================
// TOP GAINERS / LOSERS 24h (CoinGecko markets — sin API key)
// ============================================================
export interface MarketMover {
  id: string;
  symbol: string;
  name: string;
  priceUsd: number;
  changePercent24h: number;
  marketCapRank?: number;
  thumb: string;
}

interface CoingeckoMarketItem {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
}

export async function fetchTopMovers(): Promise<{ gainers: MarketMover[]; losers: MarketMover[] }> {
  // Top 100 por market cap, ordenamos localmente por % cambio 24h
  const url = "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h";
  const { data } = await fetchWithCache<CoingeckoMarketItem[]>(url, {
    provider: "coingecko",
    ttlMs: 2 * 60 * 1000,
    cacheKey: "coingecko:markets:top100",
  });
  if (!data || !Array.isArray(data)) return { gainers: [], losers: [] };
  const sorted = [...data].sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
  const gainers: MarketMover[] = sorted.slice(0, 5).map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    priceUsd: c.current_price,
    changePercent24h: c.price_change_percentage_24h || 0,
    marketCapRank: c.market_cap_rank,
    thumb: c.image,
  }));
  const losers: MarketMover[] = sorted.slice(-5).reverse().map((c) => ({
    id: c.id,
    symbol: c.symbol,
    name: c.name,
    priceUsd: c.current_price,
    changePercent24h: c.price_change_percentage_24h || 0,
    marketCapRank: c.market_cap_rank,
    thumb: c.image,
  }));
  return { gainers, losers };
}

// ============================================================
// SPARKLINE 7d — mini chart para ver tendencia
// ============================================================
// CoinGecko /coins/{id}/market_chart?vs_currency=usd&days=7&interval=daily
export interface SparklinePoint {
  timestamp: number;
  price: number;
}

export async function fetchSparkline(asset: string, days: number = 7): Promise<SparklinePoint[]> {
  const { coingeckoId } = await import("./providers/coingecko");
  const coinId = coingeckoId(asset);
  if (!coinId) return [];
  const url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const { data } = await fetchWithCache<{ prices: [number, number][] }>(url, {
    provider: "coingecko",
    ttlMs: 5 * 60 * 1000,
    cacheKey: `coingecko:sparkline:${coinId}:${days}`,
  });
  if (!data || !data.prices) return [];
  return data.prices.map(([ts, price]) => ({ timestamp: ts, price }));
}

// ============================================================
// STAKING YIELD — APY aproximado de ETH/SOL/etc
// ============================================================
// Estos datos no están en una API pública universal. Usamos
// valores estáticos verificados semanalmente desde Staking Rewards
// (https://stakingrewards.com/) — claramente etiquetados como
// "actualizado manualmente" para no prometer datos en tiempo real.
// En producción se podría conectar a la API de Staking Rewards
// (requiere API key).

export interface StakingYield {
  asset: string;
  apyPercent: number;
  source: string;
  lastUpdated: string;
  notes: string;
}

// Valores actualizados Sept 2024 (Staking Rewards, precios referenciales)
export const STAKING_YIELDS: StakingYield[] = [
  {
    asset: "ETH",
    apyPercent: 3.2,
    source: "Staking Rewards (actualizado manualmente)",
    lastUpdated: "Sept 2024",
    notes: "Staking en Ethereum 2.0. Yield variable según comisión del validator. Requiere 32 ETH para validator propio, o usar pools como Lido (stETH), Rocket Pool (rETH).",
  },
  {
    asset: "SOL",
    apyPercent: 6.5,
    source: "Staking Rewards (actualizado manualmente)",
    lastUpdated: "Sept 2024",
    notes: "Staking en Solana. Yield variable según comisión del validator. Mínimo 0.01 SOL para delegar, 0% lock-up (epoch = ~2 días).",
  },
  {
    asset: "ADA",
    apyPercent: 4.0,
    source: "Staking Rewards (actualizado manualmente)",
    lastUpdated: "Sept 2024",
    notes: "Staking en Cardano. Sin lock-up. Yield variable según pool.",
  },
  {
    asset: "DOT",
    apyPercent: 12.0,
    source: "Staking Rewards (actualizado manualmente)",
    lastUpdated: "Sept 2024",
    notes: "Staking en Polkadot. Lock-up 28 días. Mínimo 1 DOT para nominar.",
  },
  {
    asset: "ATOM",
    apyPercent: 14.0,
    source: "Staking Rewards (actualizado manualmente)",
    lastUpdated: "Sept 2024",
    notes: "Staking en Cosmos Hub. Lock-up 21 días.",
  },
  {
    asset: "MATIC",
    apyPercent: 4.5,
    source: "Staking Rewards (actualizado manualmente)",
    lastUpdated: "Sept 2024",
    notes: "Staking en Polygon (POL). Sin lock-up.",
  },
];
