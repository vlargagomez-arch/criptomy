"use client";

import { useEffect, useState, useMemo } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  Filter,
  TrendingUp,
  Star,
  Shield,
  Store,
  ArrowRight,
} from "lucide-react";
import {
  ChainConfig,
  PaymentMethodConfig,
  CHAINS,
  PAYMENT_METHODS,
  FIAT_CURRENCIES,
} from "@/lib/blockchain/config";
import {
  fmtCrypto,
  fmtFiat,
  timeAgo,
  reputationLabel,
  avatarGradient,
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

export default function MarketplaceView() {
  const { user } = useApp();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainFilter, setChainFilter] = useState<string>("all");
  const [assetFilter, setAssetFilter] = useState<string>("all");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);

  useEffect(() => {
    fetchOffers();
  }, [chainFilter, assetFilter, currencyFilter, typeFilter, paymentFilter]);

  async function fetchOffers() {
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
  }

  const filtered = useMemo(() => {
    if (!search) return offers;
    const s = search.toLowerCase();
    return offers.filter(
      (o) =>
        o.creator.alias.toLowerCase().includes(s) ||
        o.asset.toLowerCase().includes(s) ||
        o.terms.toLowerCase().includes(s) ||
        o.paymentMethods.toLowerCase().includes(s)
    );
  }, [offers, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Store className="w-5 h-5 text-emerald-400" />
            Mercado P2P
          </h1>
          <p className="text-sm text-slate-400">
            {offers.length} ofertas activas · sin KYC · escrow on-chain
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card className="bg-slate-900/60 border-slate-800 p-4">
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
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="SELL">Vendedores</SelectItem>
              <SelectItem value="BUY">Compradores</SelectItem>
            </SelectContent>
          </Select>
          <Select value={chainFilter} onValueChange={setChainFilter}>
            <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100 text-sm">
              <SelectValue placeholder="Cadena" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
              <SelectItem value="all">Todas</SelectItem>
              {Object.values(CHAINS).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.symbol})
                </SelectItem>
              ))}
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
        </div>
      </Card>

      {/* Lista de ofertas */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full bg-slate-900" />
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
          {filtered.map((o) => (
            <OfferRow key={o.id} offer={o} onAccept={() => setSelectedOffer(o)} />
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

function OfferRow({ offer, onAccept }: { offer: Offer; onAccept: () => void }) {
  const { user } = useApp();
  const chain = CHAINS[offer.chain];
  const isSell = offer.type === "SELL";
  const rep = reputationLabel(offer.creator.reputationScore);
  const methods = offer.paymentMethods.split(",").slice(0, 3);

  return (
    <Card className="bg-slate-900/60 border-slate-800 p-4 hover:border-emerald-700/40 transition">
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* Tipo + asset */}
        <div className="col-span-12 sm:col-span-3">
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                isSell
                  ? "bg-red-500/10 text-red-400 border border-red-500/30"
                  : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
              }`}
            >
              {isSell ? "Vende" : "Compra"}
            </span>
            <span className="font-bold text-slate-100 text-sm">{offer.asset}</span>
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: chain?.color }}
              title={chain?.name}
            />
          </div>
          <div className="text-[11px] text-slate-500 mt-1">{chain?.name}</div>
        </div>

        {/* Cantidad */}
        <div className="col-span-6 sm:col-span-2">
          <div className="text-[10px] text-slate-500 uppercase">Cantidad</div>
          <div className="text-sm font-mono text-slate-200">
            {fmtCrypto(offer.amount)} {offer.asset}
          </div>
          {offer.minAmount && (
            <div className="text-[10px] text-slate-500">
              min {fmtCrypto(offer.minAmount)}
            </div>
          )}
        </div>

        {/* Precio */}
        <div className="col-span-6 sm:col-span-2">
          <div className="text-[10px] text-slate-500 uppercase">Precio</div>
          <div className="text-sm font-mono text-emerald-400">
            {fmtFiat(offer.pricePerUnit, offer.currency)}/{offer.asset}
          </div>
          {offer.priceType === "MARKET" && offer.marketMargin && (
            <div className="text-[10px] text-slate-500">
              {offer.marketMargin > 0 ? "+" : ""}
              {offer.marketMargin}% mercado
            </div>
          )}
        </div>

        {/* Métodos */}
        <div className="col-span-12 sm:col-span-3">
          <div className="text-[10px] text-slate-500 uppercase">Pago</div>
          <div className="flex flex-wrap gap-1 mt-0.5">
            {methods.map((m) => {
              const pm = PAYMENT_METHODS.find((p) => p.id === m);
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
            {offer.paymentMethods.split(",").length > 3 && (
              <Badge
                variant="outline"
                className="text-[10px] py-0 px-1.5 bg-slate-950 border-slate-700 text-slate-400"
              >
                +{offer.paymentMethods.split(",").length - 3}
              </Badge>
            )}
          </div>
        </div>

        {/* Vendedor + acción */}
        <div className="col-span-12 sm:col-span-2 flex items-center justify-between sm:justify-end gap-2">
          <div className="flex items-center gap-1.5">
            <Avatar
              className={`w-7 h-7 bg-gradient-to-br ${avatarGradient(offer.creator.avatarSeed)}`}
            >
              <AvatarFallback className="bg-transparent text-white text-[10px]">
                {offer.creator.alias.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <div className="text-xs text-slate-200 flex items-center gap-1">
                {offer.creator.alias}
                {offer.creator.torOnly && (
                  <Shield className="w-2.5 h-2.5 text-emerald-500" />
                )}
              </div>
              <div className={`text-[10px] ${rep.color}`}>
                ★ {offer.creator.reputationScore.toFixed(0)} ·{" "}
                {offer.creator.totalTrades} trades
              </div>
            </div>
          </div>
          <Button
            size="sm"
            onClick={onAccept}
            disabled={!user || user.id === offer.creator.id}
            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
          >
            {isSell ? "Comprar" : "Vender"}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </div>

      {offer.terms && (
        <div className="mt-3 pt-3 border-t border-slate-800 text-xs text-slate-400">
          <span className="text-slate-500">Términos: </span>
          {offer.terms}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-600">
        <span>hace {timeAgo(offer.createdAt).replace("hace ", "")}</span>
        <span>Ventana de pago: {offer.paymentWindowMin} min</span>
      </div>
    </Card>
  );
}
