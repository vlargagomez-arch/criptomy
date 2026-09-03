"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight, ArrowLeftRight, Loader2, TrendingUp, TrendingDown,
  Activity, Info, ShieldCheck, Globe2, RefreshCw,
} from "lucide-react";

interface PriceData {
  price: number;
  source: string;
  updatedAt: number;
}

interface P2PPrice {
  price: number;
  provider: string;
  advertisers: number;
}

const CRYPTOS = [
  { sym: "BTC", name: "Bitcoin", icon: "₿" },
  { sym: "ETH", name: "Ethereum", icon: "Ξ" },
  { sym: "USDT", name: "Tether", icon: "₮" },
  { sym: "USDC", name: "USD Coin", icon: "$" },
  { sym: "SOL", name: "Solana", icon: "◎" },
  { sym: "BNB", name: "BNB", icon: "⬡" },
  { sym: "LINK", name: "Chainlink", icon: "⬡" },
];

const FIATS = [
  { code: "USD", name: "Dólar", flag: "🇺🇸" },
  { code: "COP", name: "Peso Colombiano", flag: "🇨🇴" },
  { code: "MXN", name: "Peso Mexicano", flag: "🇲🇽" },
  { code: "ARS", name: "Peso Argentino", flag: "🇦🇷" },
  { code: "BRL", name: "Real Brasileño", flag: "🇧🇷" },
  { code: "CLP", name: "Peso Chileno", flag: "🇨🇱" },
  { code: "PEN", name: "Sol Peruano", flag: "🇵🇪" },
  { code: "VES", name: "Bolívar Venezolano", flag: "🇻🇪" },
];

// Tasas aproximadas USD → fiat (actualizadas Sept 2024)
const USD_RATES: Record<string, number> = {
  USD: 1,
  COP: 4100,
  MXN: 18.5,
  ARS: 950,
  BRL: 5.05,
  CLP: 950,
  PEN: 3.75,
  VES: 36,
};

export default function ConversorView() {
  const [crypto, setCrypto] = useState("USDT");
  const [fiat, setFiat] = useState("COP");
  const [amount, setAmount] = useState("100");
  const [chainlinkPrice, setChainlinkPrice] = useState<PriceData | null>(null);
  const [p2pPrice, setP2PPrice] = useState<P2PPrice | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    // 1) Precio Chainlink (USD)
    try {
      const res = await fetch(`/api/price?pair=${crypto}/USD`);
      if (res.ok) {
        const data = await res.json();
        if (data.price) {
          setChainlinkPrice({
            price: data.price,
            source: data.source || `Chainlink ${crypto}/USD`,
            updatedAt: data.updatedAt || Math.floor(Date.now() / 1000),
          });
        }
      }
    } catch {}

    // 2) Precio P2P Binance (si fiat no es USD/EUR)
    if (fiat !== "USD" && fiat !== "EUR") {
      try {
        const res = await fetch(`/api/scanner/p2p?asset=${crypto}&fiat=${fiat}&tradeType=BUY`);
        if (res.ok) {
          const data = await res.json();
          if (data.offers && data.offers.length > 0) {
            // Promedio de las 5 mejores ofertas
            const top5 = data.offers.slice(0, 5);
            const avg = top5.reduce((sum: number, o: { price: number }) => sum + o.price, 0) / top5.length;
            setP2PPrice({
              price: avg,
              provider: "Binance P2P",
              advertisers: data.offers.length,
            });
          } else {
            setP2PPrice(null);
          }
        }
      } catch {}
    } else {
      setP2PPrice(null);
    }

    setLoading(false);
  }, [crypto, fiat]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  // Cálculos
  const cryptoAmount = parseFloat(amount) || 0;
  const usdPrice = chainlinkPrice?.price || 0;
  const fiatRate = USD_RATES[fiat] || 1;

  // Precio oficial (Chainlink USD → convertido a fiat local)
  const officialPricePerUnit = usdPrice * fiatRate;
  const officialTotal = cryptoAmount * officialPricePerUnit;

  // Precio P2P (mercado real, no conversión)
  const p2pPricePerUnit = p2pPrice?.price || 0;
  const p2pTotal = cryptoAmount * p2pPricePerUnit;

  // Spread entre oficial y P2P
  const spread = p2pPricePerUnit > 0 && officialPricePerUnit > 0
    ? ((p2pPricePerUnit - officialPricePerUnit) / officialPricePerUnit) * 100
    : 0;

  const fmtPrice = (n: number, max = 2) => {
    if (!n) return "—";
    return n.toLocaleString(undefined, { maximumFractionDigits: max, minimumFractionDigits: 0 });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ArrowLeftRight className="w-6 h-6 text-emerald-400" />
          Conversor Cripto → Fiat
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Convierte cripto a tu moneda local en tiempo real. Compara precio oficial (Chainlink)
          vs precio de mercado (Binance P2P). Útil para remesas, comercios, y saber cuánto cobrar.
        </p>
      </div>

      {/* Conversor principal */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        {/* Selector cripto */}
        <div className="mb-4">
          <label className="text-[11px] text-slate-400 uppercase">Cripto</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {CRYPTOS.map((c) => (
              <button
                key={c.sym}
                onClick={() => setCrypto(c.sym)}
                className={`px-3 py-2 text-sm rounded-lg transition flex items-center gap-1.5 ${
                  crypto === c.sym
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span className="text-base">{c.icon}</span>
                {c.sym}
              </button>
            ))}
          </div>
        </div>

        {/* Selector fiat */}
        <div className="mb-4">
          <label className="text-[11px] text-slate-400 uppercase">Moneda local</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {FIATS.map((f) => (
              <button
                key={f.code}
                onClick={() => setFiat(f.code)}
                className={`px-3 py-2 text-sm rounded-lg transition flex items-center gap-1.5 ${
                  fiat === f.code
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                <span className="text-base">{f.flag}</span>
                {f.code}
              </button>
            ))}
          </div>
        </div>

        {/* Input cantidad */}
        <div className="mb-4">
          <label className="text-[11px] text-slate-400 uppercase">Cantidad de {crypto}</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
            step="any"
            className="mt-2 w-full px-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 text-2xl font-mono focus:border-emerald-600 focus:outline-none"
          />
        </div>

        {/* Resultado principal */}
        <div className="bg-emerald-950/30 border border-emerald-800/50 rounded-xl p-4 mb-4">
          <div className="text-center">
            <div className="text-[11px] text-slate-500 uppercase mb-2">
              {cryptoAmount} {crypto} equivale a
            </div>
            <div className="text-4xl font-bold text-emerald-400 font-mono">
              {fmtPrice(p2pPricePerUnit > 0 ? p2pTotal : officialTotal, 0)} {fiat}
            </div>
            <div className="text-xs text-slate-500 mt-2">
              {p2pPricePerUnit > 0 ? "Precio de mercado P2P (Binance)" : "Precio oficial (Chainlink → USD → fiat)"}
            </div>
          </div>
        </div>

        {/* Refresh */}
        <button
          onClick={load}
          disabled={loading}
          className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm flex items-center justify-center gap-2 transition"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Actualizar precios
        </button>
      </div>

      {/* Comparación de precios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Precio oficial */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase">Precio Oficial (Chainlink)</h3>
          </div>
          <div className="text-2xl font-bold text-slate-100 font-mono">
            {fmtPrice(officialPricePerUnit, 2)} {fiat}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            1 {crypto} = {fmtPrice(usdPrice, 4)} USD × {fmtPrice(fiatRate, 0)} {fiat}/USD
          </div>
          <div className="text-[10px] text-slate-600 mt-2 italic">
            Precio descentralizado on-chain. Referencia institucional.
          </div>
        </div>

        {/* Precio P2P */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-semibold text-slate-200 uppercase">Precio Mercado (Binance P2P)</h3>
          </div>
          {p2pPricePerUnit > 0 ? (
            <>
              <div className="text-2xl font-bold text-emerald-400 font-mono">
                {fmtPrice(p2pPricePerUnit, 2)} {fiat}
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Promedio de {p2pPrice?.advertisers || 0} vendedores
              </div>
              <div className="text-[10px] text-slate-600 mt-2 italic">
                Precio real de calle. Lo que pagas comprando P2P.
              </div>
            </>
          ) : (
            <div className="text-sm text-amber-400">
              No hay ofertas P2P para {crypto}/{fiat}
            </div>
          )}
        </div>
      </div>

      {/* Spread */}
      {p2pPricePerUnit > 0 && officialPricePerUnit > 0 && (
        <div className={`rounded-xl p-4 mb-6 border ${
          Math.abs(spread) > 3
            ? "bg-amber-950/30 border-amber-800/50"
            : "bg-slate-900 border-slate-800"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {spread > 0 ? (
                <TrendingUp className="w-5 h-5 text-amber-400" />
              ) : (
                <TrendingDown className="w-5 h-5 text-emerald-400" />
              )}
              <div>
                <div className="text-sm font-semibold text-slate-100">
                  Spread: {spread > 0 ? "+" : ""}{spread.toFixed(2)}%
                </div>
                <div className="text-[11px] text-slate-500">
                  {spread > 0
                    ? `P2P está ${spread.toFixed(1)}% más caro que el precio oficial`
                    : `P2P está ${Math.abs(spread).toFixed(1)}% más barato que el precio oficial`}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-slate-500">Diferencia por {cryptoAmount} {crypto}</div>
              <div className={`text-sm font-mono font-bold ${spread > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                {spread > 0 ? "+" : ""}{fmtPrice(p2pTotal - officialTotal, 0)} {fiat}
              </div>
            </div>
          </div>
          {Math.abs(spread) > 3 && (
            <div className="mt-2 text-[10px] text-amber-400 bg-amber-950/30 rounded p-2">
              ⚠️ El spread es alto ({spread.toFixed(1)}%). Si vas a comprar, el precio oficial
              no refleja lo que vas a pagar. Usa el precio P2P como referencia real.
            </div>
          )}
        </div>
      )}

      {/* Tabla de conversiones rápidas */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6">
        <h3 className="text-xs font-semibold text-slate-200 uppercase mb-3 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-400" />
          Conversiones rápidas
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[0.1, 1, 10, 100].map((amt) => (
            <div key={amt} className="bg-slate-800/50 rounded-lg p-3 text-center">
              <div className="text-xs text-slate-500">{amt} {crypto}</div>
              <div className="text-sm font-mono font-bold text-slate-100">
                {fmtPrice(
                  (p2pPricePerUnit > 0 ? p2pPricePerUnit : officialPricePerUnit) * amt,
                  0
                )} {fiat}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <Globe2 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase">¿Por qué importa esto?</h3>
        </div>
        <p className="text-[12px] text-slate-400">
          En Latinoamérica, millones de personas usan cripto a diario pero no saben cuánto vale
          en su moneda local. Los comercios que aceptan cripto no saben cuánto cobrar.
          Las personas que envían remesas no saben cuánto llega. Este conversor da el precio
          <b className="text-slate-300"> oficial (Chainlink, descentralizado) y el precio real de mercado (Binance P2P)</b>,
          para que tomes decisiones con datos reales, no estimaciones.
        </p>
      </div>
    </div>
  );
}
