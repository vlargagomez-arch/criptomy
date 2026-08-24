"use client";

import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Shield,
  Lock,
  Network,
  Globe,
  Zap,
  Eye,
  Fingerprint,
  Scale,
  Code,
  ArrowRight,
} from "lucide-react";

export default function HomeView() {
  const { user, setTab } = useApp();

  return (
    <div className="space-y-12 py-8">
      {/* Hero */}
      <section className="text-center space-y-6 max-w-3xl mx-auto px-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-900/50 text-xs text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          MVP funcional · Multi-chain · Sin KYC
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 bg-clip-text text-transparent">
            Compre y venda cripto
          </span>
          <br />
          sin revelar quién es usted
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto">
          Plataforma P2P inspirada en LocalBitcoins, pero con escrow on-chain,
          soporte multi-chain (Ethereum, Bitcoin, Tron, Monero), cifrado
          extremo-a-extremo y modo Tor nativo. Sin KYC. Sin custodia. Sin
          intermediarios que congelen sus fondos.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button
            onClick={() => setTab("mercado")}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Explorar mercado
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <Button
            onClick={() => setTab("crear")}
            variant="outline"
            size="lg"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
          >
            Publicar oferta
          </Button>
        </div>
      </section>

      {/* Stats / portada */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto px-4">
        {[
          { label: "Cadenas soportadas", value: "4", sub: "ETH · BTC · TRX · XMR" },
          { label: "Métodos de pago", value: "16+", sub: "COP · USD · EUR · regional" },
          { label: "KYC requerido", value: "0", sub: "Nunca" },
          { label: "Custodia de fondos", value: "0", sub: "Escrow on-chain" },
        ].map((s) => (
          <Card
            key={s.label}
            className="bg-slate-900/60 border-slate-800 p-4 text-center"
          >
            <div className="text-3xl font-bold text-emerald-400">{s.value}</div>
            <div className="text-xs text-slate-300 mt-1">{s.label}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{s.sub}</div>
          </Card>
        ))}
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-8 text-slate-100">
          Por qué es diferente
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Shield,
              title: "Escrow on-chain",
              desc: "Smart contract en Ethereum retiene los fondos hasta que el vendedor confirme el pago fiat. Ni la plataforma ni nadie puede robarlos.",
            },
            {
              icon: Network,
              title: "Multi-chain real",
              desc: "Soporte nativo para Ethereum (ERC20), Bitcoin, Tron (TRC20) y Monero. Compre BTC con Nequi, pague USDT con PIX, intercambie XMR por SEPA.",
            },
            {
              icon: Lock,
              title: "Cifrado E2E",
              desc: "Mensajes entre comprador y vendedor cifrados con ECDH P-256 + AES-GCM-256. El servidor solo ve ciphertexts. Nadie más puede leerlos.",
            },
            {
              icon: Eye,
              title: "Sin KYC, sin PII",
              desc: "Solo necesita una dirección de billetera y un alias. Ni email, ni teléfono, ni documento. Como era LocalBitcoins en 2013.",
            },
            {
              icon: Fingerprint,
              title: "Reputación pseudónima",
              desc: "Sistema de feedback acumulativo. Cada trade completado suma reputación. Disputas restan. Todo vinculado al alias, no a la identidad.",
            },
            {
              icon: Scale,
              title: "Resolución de disputas",
              desc: "Si las partes no se ponen de acuerdo, un árbitro opcional (designado al crear el trade) resuelve on-chain con prueba criptográfica.",
            },
            {
              icon: Globe,
              title: "Tor-friendly",
              desc: "Compatible con Tor Browser y servicios ocultos .onion. Marque su perfil como Tor-only para exigirlo a las contrapartes.",
            },
            {
              icon: Zap,
              title: "Sin comisiones ocultas",
              desc: "Solo 0.25% sobre el trade completado, cobrado por el smart contract. Sin comisión por crear oferta, sin comisión por cancelar.",
            },
            {
              icon: Code,
              title: "Código abierto",
              desc: "Smart contract en Solidity, frontend Next.js, todo auditable. Despliegue su propio nodo si no confía en este.",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <Card
                key={f.title}
                className="bg-slate-900/40 border-slate-800 p-5 hover:border-emerald-700/50 transition"
              >
                <div className="w-10 h-10 rounded-lg bg-emerald-950/50 border border-emerald-900/50 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-1">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="max-w-4xl mx-auto px-4">
        <h2 className="text-2xl font-bold text-center mb-8 text-slate-100">
          Cómo funciona un trade
        </h2>
        <div className="grid md:grid-cols-5 gap-3">
          {[
            { n: 1, t: "Vendedor publica", d: "Crea oferta: vendo 0.1 BTC por 4.500.000 COP vía Nequi" },
            { n: 2, t: "Comprador acepta", d: "Selecciona la oferta, indica cantidad y método de pago" },
            { n: 3, t: "Vendedor deposita", d: "Bloquea los cripto en el smart contract de escrow" },
            { n: 4, t: "Comprador paga fiat", d: "Hace la transferencia Nequi y marca pago enviado" },
            { n: 5, t: "Vendedor libera", d: "Confirma recepción y el escrow envía cripto al comprador" },
          ].map((s) => (
            <Card key={s.n} className="bg-slate-900/40 border-slate-800 p-4">
              <div className="w-7 h-7 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-2">
                {s.n}
              </div>
              <div className="text-sm font-semibold text-slate-100 mb-1">{s.t}</div>
              <p className="text-xs text-slate-400 leading-relaxed">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Aviso legal */}
      <section className="max-w-3xl mx-auto px-4">
        <Card className="bg-amber-950/20 border-amber-900/40 p-5">
          <div className="flex gap-3">
            <div className="text-amber-400 text-xl">⚠️</div>
            <div className="text-sm text-amber-200/90 space-y-2">
              <p className="font-semibold">Aviso legal importante</p>
              <p>
                LocalBitcoins cerró en febrero de 2023 por presión regulatoria y
                por haber implementado KYC en 2019. Operar un exchange sin KYC
                es ilegal en la mayoría de jurisdicciones, incluyendo Colombia
                (Circular 029 de 2014 de la Superfinanciera y Ley 1581 de
                protección de datos).
              </p>
              <p>
                Este MVP es <strong>código educativo y técnico</strong> que
                demuestra cómo funciona la arquitectura P2P con escrow on-chain.
                Antes de desplegarlo en producción con dinero real, consulte a
                un abogado especializado en criptoactivos de su jurisdicción.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* CTA */}
      {!user && (
        <section className="text-center py-8">
          <Button
            onClick={() => setTab("mercado")}
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            Empezar a explorar
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </section>
      )}
    </div>
  );
}
