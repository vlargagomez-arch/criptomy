"use client";

import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield, Lock, Eye, Fingerprint, ArrowRight, Store, Trophy, Wallet,
} from "lucide-react";

export default function HomeView() {
  const { user, setTab } = useApp();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-slate-950 to-teal-950/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-xs text-emerald-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Multi-chain · Ethereum · Bitcoin · Tron · Monero
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-100 mb-6">
              Cripto P2P
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                sin KYC, sin custodia
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
              Compre y venda criptomonedas persona a persona con escrow on-chain,
              chat cifrado extremo a extremo, y soporte para Tor. Sin verificar
              identidad, sin intermediarios.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={() => setTab("mercado")} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-6">
                <Store className="w-4 h-4 mr-2" />
                Explorar mercado
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <Button onClick={() => setTab("crear")} variant="outline" size="lg" className="border-slate-700 text-slate-200 hover:bg-slate-800 h-12 px-6">
                Publicar oferta
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
              <span>✓ 0% KYC</span>
              <span>✓ Escrow on-chain</span>
              <span>✓ Chat cifrado E2E</span>
              <span>✓ Compatible con Tor</span>
            </div>
          </div>
        </div>
      </section>

      {/* Productos */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Plataforma</h2>
          <p className="text-sm text-slate-400">Todo lo que necesitas para operar cripto sin revelar tu identidad</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ProductCard icon={Store} color="emerald" title="Mercado P2P" description="Compre y venda cripto con pago fiat. Nequi, PIX, SEPA, PayPal, efectivo." action={() => setTab("mercado")} cta="Ver ofertas" />
          <ProductCard icon={Trophy} color="yellow" title="Retos Gaming" description="Apuesta USDT en partidas 1v1. LoL, Valorant, FIFA, CS2 y más juegos." action={() => setTab("retos")} cta="Ver retos" />
          <ProductCard icon={Wallet} color="teal" title="Billetera" description="Saldos reales on-chain. Ethereum, Bitcoin, Tron y Monero vía RPC." action={() => setTab("billetera")} cta="Ver saldos" />
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="border-t border-slate-800 bg-slate-950/50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-100 mb-2">Cómo funciona un trade</h2>
            <p className="text-sm text-slate-400">El vendedor deposita cripto en escrow · el comprador paga fiat · se libera el escrow</p>
          </div>
          <div className="grid md:grid-cols-5 gap-4">
            {[
              { n: 1, t: "Publicar", d: "El vendedor crea una oferta con precio y métodos de pago" },
              { n: 2, t: "Aceptar", d: "El comprador selecciona cantidad y método de pago fiat" },
              { n: 3, t: "Escrow", d: "El vendedor bloquea los cripto en el smart contract" },
              { n: 4, t: "Pagar", d: "El comprador hace la transferencia fiat y la marca" },
              { n: 5, t: "Liberar", d: "El vendedor confirma y el escrow envía cripto al comprador" },
            ].map((s) => (
              <div key={s.n} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-full bg-emerald-600 text-white text-sm font-bold flex items-center justify-center mb-3 shadow-lg shadow-emerald-500/20">
                    {s.n}
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mb-1">{s.t}</div>
                  <p className="text-xs text-slate-400 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-slate-100 mb-2">Privacidad por diseño</h2>
          <p className="text-sm text-slate-400">Cada decisión técnica prioriza tu anonimato</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Feature icon={Lock} title="Escrow on-chain" desc="Smart contract en Solidity retiene los fondos hasta confirmar pago." />
          <Feature icon={Eye} title="Sin KYC, sin PII" desc="Solo necesitas una dirección de wallet y un alias. No pedimos email ni documento." />
          <Feature icon={Lock} title="Cifrado E2E" desc="Mensajes cifrados con ECDH P-256 + AES-GCM-256." />
          <Feature icon={Fingerprint} title="Reputación pseudónima" desc="Sistema de feedback acumulativo vinculado al alias." />
          <Feature icon={Shield} title="Multi-chain" desc="Ethereum, Bitcoin, Tron y Monero." />
          <Feature icon={Eye} title="Tor-friendly" desc="Compatible con servicios ocultos .onion." />
        </div>
      </section>

      {/* Aviso legal */}
      <section className="border-t border-slate-800 bg-amber-950/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
          <div className="flex gap-4">
            <div className="text-amber-400 text-2xl shrink-0">⚠️</div>
            <div className="text-sm text-amber-200/80 space-y-2">
              <p className="font-semibold text-amber-200">Aviso legal</p>
              <p>LocalBitcoins cerró en febrero de 2023 por presión regulatoria. Operar un exchange sin KYC puede violar leyes de tu jurisdicción.</p>
              <p>Este software es educativo y técnico. Consulta a un abogado antes de usarlo con fondos reales.</p>
            </div>
          </div>
        </div>
      </section>

      {!user && (
        <section className="border-t border-slate-800 bg-gradient-to-br from-emerald-950/30 to-slate-950">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
            <h2 className="text-3xl font-bold text-slate-100 mb-4">¿Listo para empezar?</h2>
            <p className="text-slate-400 mb-8">Conecta tu wallet y en 10 segundos estarás tradear.</p>
            <Button onClick={() => setTab("mercado")} size="lg" className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 px-8">
              Explorar mercado
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function ProductCard({ icon: Icon, color, title, description, action, cta }: {
  icon: React.ElementType; color: string; title: string; description: string; action: () => void; cta: string;
}) {
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-950/50 text-emerald-400 border-emerald-800/50",
    yellow: "bg-yellow-950/50 text-yellow-400 border-yellow-800/50",
    teal: "bg-teal-950/50 text-teal-400 border-teal-800/50",
  };
  return (
    <Card className="group bg-slate-900/40 border-slate-800 p-5 hover:border-slate-700 hover:bg-slate-900/60 transition cursor-pointer" onClick={action}>
      <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-3 ${colorMap[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-semibold text-slate-100 mb-1">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed mb-4">{description}</p>
      <span className="text-xs font-medium text-emerald-400 group-hover:underline flex items-center gap-1">
        {cta} <ArrowRight className="w-3 h-3" />
      </span>
    </Card>
  );
}

function Feature({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="p-5 rounded-xl bg-slate-900/40 border border-slate-800">
      <div className="w-9 h-9 rounded-lg bg-emerald-950/50 border border-emerald-800/50 flex items-center justify-center mb-3">
        <Icon className="w-4 h-4 text-emerald-400" />
      </div>
      <h3 className="font-semibold text-slate-100 mb-1 text-sm">{title}</h3>
      <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
    </div>
  );
}
