"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, TrendingUp, Star, Shield, Store, ArrowRight, Bitcoin,
  RefreshCw, AlertTriangle, Lock, Clock, Zap, ChevronDown, ChevronUp,
  Activity,
} from "lucide-react";
import {
  ChainConfig, PaymentMethodConfig, CHAINS, PAYMENT_METHODS, FIAT_CURRENCIES,
} from "@/lib/blockchain/config";
import {
  fmtCrypto, fmtFiat, timeAgo, reputationLabel, avatarGradient,
} from "@/lib/format";
import AcceptOfferDialog from "./AcceptOfferDialog";

interface OfferCreator {
  id: string;
  alias: string;
  reputationScore: number;
  totalTrades: number;
  avatarSeed: string | null;
  torOnly: boolean;
}

interface Offer {
  id: string;
  type: "BUY" | "SELL";
  chain: keyof typeof CHAINS;
  asset: string;
  amount: number;
  minAmount: number | null;
  maxAmount: number | null;
  currency: string;
  pricePerUnit: number;
  priceType: "FIXED" | "MARKET";
  marketMargin: number | null;
  paymentMethods: string;
  terms: string;
  paymentWindowMin: number;
  status: string;
  createdAt: string;
  creator: OfferCreator;
}

interface MarketPrice {
  price: number;
  source: string;
  updatedAt: number;
}

// ============================================================
// MarketplaceView — LocalBitcoins-style BTC P2P marketplace
// ============================================================
export default function MarketplaceView() {
  const { user } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | "BUY" | "SELL">("SELL");
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [assetFilter, setAssetFilter] = useState<string>("BTC");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [marketPrice, setMarketPrice] = useState<MarketPrice | null>(null);
  const [priceLoading, setPriceLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"price_asc" | "price_desc" | "reputation" | "trades">("price_asc");

  // ---- Cargar ofertas ----
  const fetchOffers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (chainFilter !== "all") params.set("chain", chainFilter);
      if (assetFilter !== "all") params.set("asset", assetFilter);
      if (currencyFilter !== "all") params.set("currency", currencyFilter);
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (paymentFilter !== "all") params.set("paymentMethod", paymentFilter);
      const res = await fetch(`/api/offers?${params}`);
      const data = await res.json();
      setOffers(data.offers || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [chainFilter, assetFilter, currencyFilter, typeFilter, paymentFilter]);

  // ---- Cargar precio de mercado real (CoinGecko) ----
  const fetchMarketPrice = useCallback(async () => {
    setPriceLoading(true);
    try {
      const asset = assetFilter === "all" ? "BTC" : assetFilter;
      const currency = currencyFilter === "all" ? "USD" : currencyFilter;
      const res = await fetch(`/api/market-price?asset=${asset}&currency=${currency}`);
      if (res.ok) {
        const data = await res.json();
        setMarketPrice({ price: data.price, source: data.source, updatedAt: data.updatedAt });
      }
    } catch {}
    setPriceLoading(false);
  }, [assetFilter, currencyFilter]);

  useEffect(() => { fetchOffers(); }, [fetchOffers]);
  useEffect(() => { fetchMarketPrice(); }, [fetchMarketPrice]);
  useEffect(() => {
    const i = setInterval(fetchMarketPrice, 60_000);
    return () => clearInterval(i);
  }, [fetchMarketPrice]);

  // ---- Filtrar + ordenar ----
  const filtered = useMemo(() => {
    let list = [...offers];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(o =>
        o.creator.alias.toLowerCase().includes(s) ||
        o.asset.toLowerCase().includes(s) ||
        o.terms.toLowerCase().includes(s) ||
        o.paymentMethods.toLowerCase().includes(s)
      );
    }
    switch (sortBy) {
      case "price_asc":  list.sort((a, b) => a.pricePerUnit - b.pricePerUnit); break;
      case "price_desc": list.sort((a, b) => b.pricePerUnit - a.pricePerUnit); break;
      case "reputation": list.sort((a, b) => b.creator.reputationScore - a.creator.reputationScore); break;
      case "trades":     list.sort((a, b) => b.creator.totalTrades - a.creator.totalTrades); break;
    }
    return list;
  }, [offers, search, sortBy]);

  const activeCurrency = currencyFilter === "all" ? "USD" : currencyFilter;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Hero: Comprar/Vender + precio */}
      <Card className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/20 border-emerald-800/30 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <Bitcoin className="w-5 h-5 text-amber-400" />
              <h1 className="text-xl sm:text-2xl font-bold text-slate-100">Mercado P2P Bitcoin</h1>
            </div>
            <p className="text-xs text-slate-400">
              Compra y vende Bitcoin con dinero local. Escrow integrado, reputación verificada, sin KYC.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => setTypeFilter("SELL")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  typeFilter === "SELL"
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Comprar Bitcoin
              </button>
              <button
                onClick={() => setTypeFilter("BUY")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  typeFilter === "BUY"
                    ? "bg-rose-600 text-white"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                }`}
              >
                Vender Bitcoin
              </button>
              <button
                onClick={() => setTypeFilter("all")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  typeFilter === "all"
                    ? "bg-slate-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                Todas
              </button>
            </div>
          </div>
          {/* Market price ticker */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-lg p-3 min-w-[220px]">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase text-slate-500 font-semibold">Precio mercado</div>
              <button onClick={fetchMarketPrice} className="text-slate-500 hover:text-slate-300">
                <RefreshCw className={`w-3 h-3 ${priceLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
            {priceLoading ? (
              <Skeleton className="h-8 w-32 mt-1 bg-slate-800" />
            ) : marketPrice ? (
              <>
                <div className="text-2xl font-bold text-emerald-400 font-mono mt-1">
                  {fmtFiat(marketPrice.price, activeCurrency)}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  1 {assetFilter === "all" ? "BTC" : assetFilter} · {activeCurrency} · {marketPrice.source}
                </div>
              </>
            ) : (
              <div className="text-sm text-slate-500 mt-1">No disponible</div>
            )}
          </div>
        </div>
      </Card>

      {/* Filtros */}
      <Card className="bg-slate-900/60 border-slate-800 p-4 space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          <div className="col-span-2 lg:col-span-2 relative">
            <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Buscar alias, asset, términos…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 bg-slate-950 border-slate-700 text-slate-100 placeholder:text-slate-600 text-sm"
            />
          </div>
          <Select value={assetFilter} onValueChange={setAssetFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm">
              <SelectValue placeholder="Asset" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="BTC">₿ BTC</SelectItem>
              <SelectItem value="ETH">Ξ ETH</SelectItem>
              <SelectItem value="USDT">💵 USDT</SelectItem>
              <SelectItem value="USDC">💵 USDC</SelectItem>
              <SelectItem value="XMR">🔒 XMR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              <SelectItem value="all">Todas</SelectItem>
              {FIAT_CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm">
              <SelectValue placeholder="Pago" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100 max-h-72">
              <SelectItem value="all">Todos</SelectItem>
              {PAYMENT_METHODS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.icon} {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              <SelectItem value="price_asc">Precio: menor primero</SelectItem>
              <SelectItem value="price_desc">Precio: mayor primero</SelectItem>
              <SelectItem value="reputation">Mejor reputación</SelectItem>
              <SelectItem value="trades">Más trades</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quick payment chips */}
        <div className="flex items-center gap-1 flex-wrap pt-1">
          <span className="text-[10px] text-slate-500 mr-1">Rápido:</span>
          {["NEQUI", "DAVIPLATA", "PSE", "PAYPAL", "PIX", "CASH_IN_PERSON", "WESTERN_UNION"].map(id => {
            const pm = PAYMENT_METHODS.find(p => p.id === id);
            if (!pm) return null;
            return (
              <button
                key={id}
                onClick={() => setPaymentFilter(paymentFilter === id ? "all" : id)}
                className={`text-[10px] px-2 py-0.5 rounded transition ${
                  paymentFilter === id
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {pm.icon} {pm.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Stats bar */}
      {!loading && filtered.length > 0 && (
        <div className="flex items-center justify-between text-[11px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Activity className="w-3 h-3" /> {filtered.length} ofertas
            </span>
            {marketPrice && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" /> Mercado: {fmtFiat(marketPrice.price, activeCurrency)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Lock className="w-3 h-3" /> Escrow smart contract · <Shield className="w-3 h-3" /> Arbitraje
          </div>
        </div>
      )}

      {/* Lista de ofertas */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full bg-slate-900" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
          <Store className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-300 font-medium">No hay ofertas que coincidan</p>
          <p className="text-sm text-slate-500 mt-1">
            Pruebe ajustar los filtros o cree la primera oferta de esta combinación.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(o => (
            <OfferRow
              key={o.id}
              offer={o}
              marketPrice={marketPrice}
              onAccept={() => setSelectedOffer(o)}
            />
          ))}
        </div>
      )}

      {selectedOffer && (
        <AcceptOfferDialog
          offer={selectedOffer}
          onClose={() => setSelectedOffer(null)}
        />
      )}
    </div>
  );
}

// ============================================================
// OfferRow — Tarjeta LocalBitcoins-style
// ============================================================
function OfferRow({
  offer, marketPrice, onAccept,
}: {
  offer: Offer;
  marketPrice: MarketPrice | null;
  onAccept: () => void;
}) {
  const { user } = useApp();
  const [expanded, setExpanded] = useState(false);
  const chain = CHAINS[offer.chain];
  const isSell = offer.type === "SELL";
  const rep = reputationLabel(offer.creator.reputationScore);
  const allMethods = offer.paymentMethods.split(",");
  const methods = allMethods.slice(0, 4);

  // Calcular diferencia vs mercado
  const diffVsMarket = marketPrice && offer.currency === (marketPrice as any).currency
    ? ((offer.pricePerUnit - marketPrice.price) / marketPrice.price) * 100
    : null;
  const aboveMarket = (diffVsMarket ?? 0) > 0;

  return (
    <Card className="bg-slate-900/60 border-slate-800 hover:border-emerald-700/40 transition overflow-hidden">
      <div className="p-4">
        <div className="grid grid-cols-12 gap-3 items-center">
          {/* Trader + reputation */}
          <div className="col-span-12 sm:col-span-3">
            <div className="flex items-center gap-2.5">
              <Avatar className={`w-9 h-9 bg-gradient-to-br ${avatarGradient(offer.creator.avatarSeed)}`}>
                <AvatarFallback className="bg-transparent text-white text-[10px] font-bold">
                  {offer.creator.alias.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm text-slate-100 flex items-center gap-1 font-medium">
                  {offer.creator.alias}
                  {offer.creator.torOnly && (
                    <Shield className="w-3 h-3 text-emerald-500" title="Solo Tor" />
                  )}
                </div>
                <div className={`text-[10px] flex items-center gap-1 ${rep.color}`}>
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>{offer.creator.reputationScore.toFixed(0)}</span>
                  <span className="text-slate-500">·</span>
                  <span>{offer.creator.totalTrades} trades</span>
                  <span className="text-slate-500">·</span>
                  <span>{rep.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Precio */}
          <div className="col-span-6 sm:col-span-3">
            <div className="text-[10px] text-slate-500 uppercase">Precio</div>
            <div className="text-base font-mono text-emerald-400 font-bold">
              {fmtFiat(offer.pricePerUnit, offer.currency)}
            </div>
            <div className="text-[10px] text-slate-500">por {offer.asset}</div>
            {diffVsMarket !== null && (
              <div className={`text-[10px] font-medium mt-0.5 ${aboveMarket ? "text-rose-400" : "text-emerald-400"}`}>
                {aboveMarket ? "+" : ""}{diffVsMarket.toFixed(1)}% vs mercado
              </div>
            )}
          </div>

          {/* Límites */}
          <div className="col-span-6 sm:col-span-2">
            <div className="text-[10px] text-slate-500 uppercase">Límites</div>
            <div className="text-xs text-slate-200 font-mono">
              {offer.minAmount ? fmtFiat(offer.minAmount * offer.pricePerUnit, offer.currency) : "—"}
              {" - "}
              {offer.maxAmount ? fmtFiat(offer.maxAmount * offer.pricePerUnit, offer.currency) : fmtFiat(offer.amount * offer.pricePerUnit, offer.currency)}
            </div>
            <div className="text-[10px] text-slate-500">{offer.currency}</div>
          </div>

          {/* Métodos de pago */}
          <div className="col-span-12 sm:col-span-2">
            <div className="text-[10px] text-slate-500 uppercase">Pago</div>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {methods.map(m => {
                const pm = PAYMENT_METHODS.find(p => p.id === m);
                return (
                  <Badge
                    key={m}
                    variant="outline"
                    className="text-[10px] py-0 px-1.5 bg-slate-950 border-slate-700 text-slate-300"
                  >
                    {pm?.icon} {pm?.label || m}
                  </Badge>
                );
              })}
              {allMethods.length > 4 && (
                <Badge
                  variant="outline"
                  className="text-[10px] py-0 px-1.5 bg-slate-950 border-slate-700 text-slate-400"
                >
                  +{allMethods.length - 4}
                </Badge>
              )}
            </div>
          </div>

          {/* Acción */}
          <div className="col-span-12 sm:col-span-2 flex items-center justify-end gap-2">
            <Button
              size="sm"
              onClick={onAccept}
              disabled={!user || user.id === offer.creator.id}
              className={`text-white text-xs h-9 px-4 ${
                isSell
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-rose-600 hover:bg-rose-500"
              }`}
            >
              {isSell ? "Comprar" : "Vender"}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: chain?.color }} />
              {chain?.name}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" /> {offer.paymentWindowMin} min
            </span>
            <span className="flex items-center gap-1">
              <Lock className="w-2.5 h-2.5 text-emerald-500" /> Escrow
            </span>
            <span>· hace {timeAgo(offer.createdAt).replace("hace ", "")}</span>
          </div>
          {offer.terms && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-slate-400 hover:text-slate-200 flex items-center gap-1"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Términos
            </button>
          )}
        </div>

        {expanded && offer.terms && (
          <div className="mt-2 p-2 bg-slate-950/40 rounded text-xs text-slate-300">
            {offer.terms}
          </div>
        )}
      </div>
    </Card>
  );
}
