"use client";

import { ShieldAlert, FileCheck, Building2, Banknote, Users, Globe2, Scale } from "lucide-react";

interface ServiceCompliance {
  service: string;
  whoProvides: string;
  whoCustodies: string;
  whoDoesKyc: string;
  regulation: string;
  ourRole: string;
}

const SERVICES: ServiceCompliance[] = [
  {
    service: "Billetera Web3 (MetaMask, WalletConnect)",
    whoProvides: "Wallets auto-custodia (MetaMask, Trust, etc.)",
    whoCustodies: "El usuario (clave privada en su dispositivo)",
    whoDoesKyc: "Ninguno (no se requiere KYC para conectar)",
    regulation: "Self-custody wallets no están regulados como entidades financieras",
    ourRole: "Solo conectamos via EIP-1193. No tocamos claves privadas.",
  },
  {
    service: "Comprar cripto (On-Ramp)",
    whoProvides: "MoonPay, Transak, Ramp Network",
    whoCustodies: "Provider temporalmente (hasta confirmación on-chain)",
    whoDoesKyc: "El provider (KYC/AML conforme a su jurisdicción)",
    regulation: "VASP (Virtual Asset Service Provider) registrado en cada país",
    ourRole: "Orquestador. No tocamos fondos. No hacemos KYC. Solo redirect/iframe al provider.",
  },
  {
    service: "Vender cripto (Off-Ramp)",
    whoProvides: "MoonPay Sell, Transak Sell",
    whoCustodies: "Provider temporalmente durante conversión",
    whoDoesKyc: "El provider",
    regulation: "VASP + Money Transmitter License (varía por país)",
    ourRole: "Orquestador. No custodiamos cripto ni fiat.",
  },
  {
    service: "Enviar cripto (on-chain)",
    whoProvides: "Blockchain nativa (Ethereum, Polygon, etc.)",
    whoCustodies: "El usuario siempre (transfiere directamente P2P)",
    whoDoesKyc: "Ninguno",
    regulation: "Transacciones P2P no requieren licencia en la mayoría de jurisdicciones",
    ourRole: "Solo facilitamos la firma via MetaMask. No intermediamos.",
  },
  {
    service: "Mercado P2P (LocalBitcoins style)",
    whoProvides: "Nosotros (plataforma de encuentro)",
    whoCustodies: "Vendedor hasta confirmación. Escrow opcional via smart contract (no desplegado aún)",
    whoDoesKyc: "Ninguno (P2P real entre usuarios)",
    regulation: "Plataformas P2P requieren análisis regulatorio por país. En Colombia, SI-auto-matching puede requerir registro.",
    ourRole: "Plataforma de encuentro. No custodiamos fondos fiat. Smart contract de escrow sería auto-custodia.",
  },
  {
    service: "Retos gaming",
    whoProvides: "Nosotros + smart contract ChallengeEscrow (próximamente)",
    whoCustodies: "Smart contract en Polygon (escrow)",
    whoDoesKyc: "Ninguno (P2P entre gamers)",
    regulation: "Apuestas online requieren licencia en algunas jurisdicciones (Colombia: Coljuegos).",
    ourRole: "Orquestador. El smart contract ejecuta el pago al ganador. ⚠️ Requiere revisión legal en Colombia.",
  },
  {
    service: "Mercado NFT",
    whoProvides: "Nosotros (marketplace off-chain) + smart contract ERC-721",
    whoCustodies: "Usuario vendedor (NFT en su wallet hasta transferencia)",
    whoDoesKyc: "Ninguno",
    regulation: "Marketplace NFTs no están regulados como exchanges (no hay custodia)",
    ourRole: "Plataforma de encuentro. Comprador paga directo al vendedor (no intermediamos).",
  },
  {
    service: "Tarjetas cripto",
    whoProvides: "Crypto.com, Wirex, Gnosis Pay (emisor regulado)",
    whoCustodies: "Emisor de tarjetas",
    whoDoesKyc: "El emisor (KYC completo conforme a regulación bancaria)",
    regulation: "Emisor de tarjetas con licencia EMI (E-Money Institution) en su jurisdicción",
    ourRole: "Solo redirect al emisor. No tocamos fondos ni datos de tarjeta sensibles.",
  },
  {
    service: "Remesas internacionales",
    whoProvides: "MoneyGram, Bitso Bridge",
    whoCustodies: "Provider durante conversión + payout",
    whoDoesKyc: "El provider (origen y destino)",
    regulation: "Licencia de remesador (Colombia: Superfinanciera). VASP en cada país.",
    ourRole: "Orquestador. ⚠️ Requiere partnership comercial + revisión legal por país.",
  },
];

export default function ComplianceView() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <ShieldAlert className="w-6 h-6 text-amber-400" />
          Compliance y regulación
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Quién realmente presta cada servicio, quién custodia, quién hace KYC, y cuál es nuestra
          responsabilidad. <b>No afirmamos que integrar un proveedor nos regule automáticamente.</b>
        </p>
      </div>

      {/* Disclaimer */}
      <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-4 text-xs text-amber-300 mb-6">
        <b>⚠️ Importante.</b> Esta información es educativa y refleja nuestro entendimiento
        actual. No constituye asesoría legal. Antes de activar cualquier servicio financiero en
        producción, debe pasar revisión legal profesional por jurisdicción.
      </div>

      {/* Cards de principios */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { icon: Banknote, label: "No custodiamos", color: "text-emerald-400" },
          { icon: Users, label: "No hacemos KYC", color: "text-emerald-400" },
          { icon: Building2, label: "No emitimos tarjetas", color: "text-emerald-400" },
          { icon: Scale, label: "No evadimos ley", color: "text-emerald-400" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="bg-slate-900 border border-slate-800 rounded-lg p-3 text-center"
            >
              <Icon className={`w-6 h-6 mx-auto mb-1 ${c.color}`} />
              <div className="text-xs text-slate-300">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Tabla de servicios */}
      <div className="space-y-4">
        {SERVICES.map((s) => (
          <div
            key={s.service}
            className="bg-slate-900 border border-slate-800 rounded-xl p-4"
          >
            <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              {s.service}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <ComplianceRow label="Quién presta el servicio" value={s.whoProvides} />
              <ComplianceRow label="Quién custodia fondos" value={s.whoCustodies} />
              <ComplianceRow label="Quién hace KYC" value={s.whoDoesKyc} />
              <ComplianceRow label="Regulación" value={s.regulation} />
              <ComplianceRow label="Nuestro rol" value={s.ourRole} full />
            </div>
          </div>
        ))}
      </div>

      {/* Próximos pasos legales */}
      <div className="mt-8 bg-slate-900 border border-slate-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-cyan-400" />
          Próximos pasos legales (Colombia)
        </h3>
        <ol className="text-xs text-slate-400 space-y-2 list-decimal pl-4">
          <li>
            <b className="text-slate-200">Asesoría legal especializada</b> — contratar abogado con
            experiencia en cripto y regulación financiera colombiana.
          </li>
          <li>
            <b className="text-slate-200">Registro ante Superfinanciera</b> — si activamos
            on-ramp/off-ramp directo a usuarios colombianos, evaluar si calificamos como SI
            (Sistema de Información) o VASP no regulado.
          </li>
          <li>
            <b className="text-slate-200">Coljuegos</b> — los retos gaming con apuestas pueden
            calificar como juegos de suerte y azar. Evaluar exención skill-based.
          </li>
          <li>
            <b className="text-slate-200">UIAF</b> — reportes SAR/STR si detectamos actividad
            sospechosa (obligación AML para entidades reportantes).
          </li>
          <li>
            <b className="text-slate-200">Términos y condiciones</b> — clarificar en ToS que somos
            orquestador, no custodio, no exchange, no emisor de tarjetas.
          </li>
        </ol>
      </div>
    </div>
  );
}

function ComplianceRow({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <div className="text-slate-500 text-[10px]">{label}</div>
      <div className="text-slate-200">{value}</div>
    </div>
  );
}
