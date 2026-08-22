// Helpers de formateo

export function fmtCrypto(amount: number | undefined | null, decimals = 6): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "0";
  return amount.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function fmtFiat(amount: number | undefined | null, currency = "COP"): string {
  if (amount === undefined || amount === null || isNaN(amount)) return "0";
  const symbol: Record<string, string> = {
    COP: "$",
    USD: "$",
    EUR: "€",
    MXN: "$",
    ARS: "$",
    BRL: "R$",
    PEN: "S/",
    CLP: "$",
    VES: "Bs",
  };
  const s = symbol[currency] || "";
  return `${s}${amount.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

export function fmtDate(d: Date | string | null): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const sec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60) return "hace un momento";
  if (sec < 3600) return `hace ${Math.floor(sec / 60)} min`;
  if (sec < 86400) return `hace ${Math.floor(sec / 3600)} h`;
  return `hace ${Math.floor(sec / 86400)} días`;
}

// Genera avatar determinístico (gradiente SVG) a partir de seed
export function avatarGradient(seed: string | null): string {
  if (!seed) return "from-slate-600 to-slate-800";
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffffff;
  }
  const h1 = (hash >> 8) & 0xfff;
  const h2 = (hash << 4) & 0xfff;
  // Mantener en tonos verde/teal (estilo Monero/cypherpunk)
  const r1 = (h1 & 0xf) * 4;
  const g1 = 100 + ((h1 >> 4) & 0x7f);
  const b1 = 80 + ((h1 >> 8) & 0x7f);
  const r2 = (h2 & 0xf) * 4;
  const g2 = 60 + ((h2 >> 4) & 0x7f);
  const b2 = 100 + ((h2 >> 8) & 0x7f);
  return `from-[rgb(${r1},${g1},${b1})] to-[rgb(${r2},${g2},${b2})]`;
}

export function reputationLabel(score: number): { label: string; color: string } {
  if (score >= 90) return { label: "Excelente", color: "text-emerald-400" };
  if (score >= 75) return { label: "Bueno", color: "text-green-400" };
  if (score >= 50) return { label: "Regular", color: "text-yellow-400" };
  if (score >= 25) return { label: "Bajo", color: "text-orange-400" };
  return { label: "Riesgoso", color: "text-red-400" };
}

export function tradeStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING_ESCROW: "Pendiente escrow",
    ESCROW_FUNDED: "Escrow activo",
    PAYMENT_SENT: "Pago enviado",
    PAYMENT_CONFIRMED: "Pago confirmado",
    RELEASING: "Liberando fondos",
    COMPLETED: "Completado",
    CANCELLED: "Cancelado",
    DISPUTED: "En disputa",
  };
  return map[status] || status;
}

export function tradeStatusColor(status: string): string {
  const map: Record<string, string> = {
    PENDING_ESCROW: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
    ESCROW_FUNDED: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    PAYMENT_SENT: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
    PAYMENT_CONFIRMED: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    RELEASING: "bg-purple-500/10 text-purple-400 border-purple-500/30",
    COMPLETED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    CANCELLED: "bg-slate-500/10 text-slate-400 border-slate-500/30",
    DISPUTED: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return map[status] || "bg-slate-500/10 text-slate-400 border-slate-500/30";
}
