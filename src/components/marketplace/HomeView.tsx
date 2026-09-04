"use client";

import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import {
  Shield, Lock, Wallet, ArrowRight, Store, Trophy, Image as ImageIcon,
  ShoppingBag, TrendingDown, ArrowLeftRight, Sparkles, Bell,
  Zap, Globe2, Coins, LineChart, Search, TrendingUp,
} from "lucide-react";

export default function HomeView() {
  const { user, setTab } = useApp();

  // Si hay usuario logueado → mostrar dashboard
  // Si no → landing page
  if (user) {
    return <Dashboard />;
  }
  return <Landing />;
}

// ============================================================
// LANDING PAGE (usuario no conectado)
// ============================================================
function Landing() {
  const { setTab } = useApp();

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-950/20 via-slate-950 to-teal-950/10" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/50 border border-emerald-800/50 text-xs text-emerald-400 mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Web3 LATAM · Sin custodia · Multi-chain
            </div>
            <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-slate-100 mb-6">
              Tu plataforma
              <br />
              <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
                cripto todo-en-uno
              </span>
            </h1>
            <p className="text-base sm:text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              Compra, vende, envía, recibe, reta en juegos y descubre oportunidades Web3. Conecta tu
              MetaMask y mantén el control de tus fondos. Sin KYC forzado, sin custodia, sin claves privadas.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => {
                  const ev = new CustomEvent("open-onboarding");
                  window.dispatchEvent(ev);
                }}
              >
                <Wallet className="w-4 h-4 mr-2" />
                Conectar wallet
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-slate-700 text-slate-300 hover:bg-slate-800"
                onClick={() => setTab("oportunidades")}
              >
                Ver oportunidades Web3
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>

            <div className="mt-12 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" /> Sin custodia
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-500" /> Sin claves privadas
              </span>
              <span className="flex items-center gap-1.5">
                <Globe2 className="w-3.5 h-3.5 text-emerald-500" /> LATAM primero
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-emerald-500" /> Multi-chain
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features grid */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100">
            Todo lo que necesitas en un solo lugar
          </h2>
          <p className="text-sm text-slate-400 mt-2">
            Servicios integrados de proveedores oficiales. Tú eliges, tú decides.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              icon: Store,
              title: "Mercado P2P",
              desc: "Compra y vende cripto persona-a-persona sin KYC, como LocalBitcoins.",
              tab: "mercado-p2p",
              color: "text-purple-400",
            },
            {
              icon: Trophy,
              title: "Retos gaming",
              desc: "Apuesta USDT en 1v1 de LoL, Valorant, FIFA. Verificación con APIs reales.",
              tab: "retos",
              color: "text-blue-400",
            },
            {
              icon: ArrowLeftRight,
              title: "Enviar / Recibir",
              desc: "Transfiere cripto a cualquier wallet. QR + dirección + warning de red.",
              tab: "enviar-recibir",
              color: "text-cyan-400",
            },
            {
              icon: Sparkles,
              title: "Oportunidades Web3",
              desc: "Learn & Earn, airdrops verificados, staking, minería, trabajo Web3.",
              tab: "oportunidades",
              color: "text-yellow-400",
            },
            {
              icon: Bell,
              title: "Alertas de precio",
              desc: "Te avisamos cuando BTC/ETH cae a tu precio objetivo o hay un dip.",
              tab: "alertas",
              color: "text-orange-400",
            },
            {
              icon: LineChart,
              title: "Comparador",
              desc: "Compara comisiones, tiempo y KYC entre todos los providers disponibles.",
              tab: "comparador",
              color: "text-teal-400",
            },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <button
                key={f.title}
                onClick={() => setTab(f.tab as never)}
                className="text-left bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-emerald-600/50 transition group"
              >
                <div
                  className={`w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mb-3 ${f.color}`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-slate-100 mb-1">{f.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{f.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-800 bg-slate-900/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-100 mb-4">
            Empieza ahora, sin KYC obligatorio
          </h2>
          <p className="text-sm text-slate-400 mb-8 max-w-2xl mx-auto">
            Conecta tu MetaMask y accede a todo. El KYC lo hace el proveedor cuando es
            legalmente requerido, no nosotros.
          </p>
          <Button
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => {
              const ev = new CustomEvent("open-onboarding");
              window.dispatchEvent(ev);
            }}
          >
            <Wallet className="w-4 h-4 mr-2" />
            Conectar wallet
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 text-xs text-slate-500">
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <div>
              <div className="font-bold text-slate-300 mb-1">CriptoMy</div>
              <p>Plataforma Web3 para LATAM. Sin custodia, sin KYC forzado.</p>
            </div>
            <div className="text-xs">
              <p>
                ⚠️ Operar cripto puede ser ilegal en tu jurisdicción. Verifica regulación local.
              </p>
              <p className="mt-2">
                Los servicios de on-ramp/off-ramp son prestados por terceros regulados. Nosotros
                no custodiamos fondos.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ============================================================
// DASHBOARD (usuario logueado)
// ============================================================
function Dashboard() {
  const { user, setTab } = useApp();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Saludo */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">
          Hola, <span className="text-emerald-400">@{user.alias}</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Tu plataforma Web3 todo-en-uno. Sin custodia, sin KYC forzado.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mb-8">
        {[
          { icon: Store, label: "Mercado P2P", tab: "mercado-p2p", color: "bg-slate-700" },
          { icon: Trophy, label: "Retos", tab: "retos", color: "bg-blue-600" },
          { icon: ArrowLeftRight, label: "Enviar/Recibir", tab: "enviar-recibir", color: "bg-cyan-600" },
          { icon: TrendingUp, label: "Earn", tab: "earn", color: "bg-emerald-600" },
          { icon: Sparkles, label: "Oportunidades", tab: "oportunidades", color: "bg-yellow-600" },
          { icon: Search, label: "Buscador", tab: "buscador", color: "bg-emerald-600" },
        ].map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={() => setTab(a.tab as never)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl ${a.color} hover:opacity-90 transition text-white`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-xs font-medium">{a.label}</span>
            </button>
          );
        })}
      </div>

      {/* Resumen portafolio placeholder (wallet no conectada muestra 0) */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-900/50 border border-slate-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
            <Coins className="w-5 h-5 text-emerald-400" />
            Portafolio
          </h2>
          <button
            onClick={() => setTab("billetera")}
            className="text-xs text-emerald-400 hover:text-emerald-300"
          >
            Ver detalle →
          </button>
        </div>
        <div className="text-center py-6">
          <p className="text-xs text-slate-500 mb-3">
            Conecta tu wallet para ver tu portafolio
          </p>
          <p className="text-sm text-slate-400 font-mono">
            {user.walletAddress.slice(0, 8)}…{user.walletAddress.slice(-6)}
          </p>
        </div>
      </div>

      {/* Accesos rápidos secundarios */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => setTab("alertas")}
          className="text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-emerald-600/50 transition"
        >
          <Bell className="w-5 h-5 text-orange-400 mb-2" />
          <h3 className="text-sm font-semibold text-slate-100">Alertas de precio</h3>
          <p className="text-xs text-slate-400 mt-1">
            Recibe notificaciones cuando BTC/ETH caiga a tu objetivo.
          </p>
        </button>
        <button
          onClick={() => setTab("proveedores")}
          className="text-left bg-slate-900 border border-slate-800 rounded-xl p-4 hover:border-emerald-600/50 transition"
        >
          <Globe2 className="w-5 h-5 text-cyan-400 mb-2" />
          <h3 className="text-sm font-semibold text-slate-100">Directorio de proveedores</h3>
          <p className="text-xs text-slate-400 mt-1">
            Wallets, on-ramps, off-ramps, tarjetas, remesas.
          </p>
        </button>
      </div>
    </div>
  );
}
