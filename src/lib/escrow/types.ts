// ============================================================
// EscrowBot — Tipos y constantes
// ============================================================

export type EscrowPhase =
  | "NEGOCIANDO"
  | "FONDOS_BLOQUEADOS"
  | "EN_VERIFICACION"
  | "COMPLETADA"
  | "DISPUTA_N1"
  | "DISPUTA_N2"
  | "DISPUTA_N3"
  | "CANCELADA";

export type ProductType =
  | "SOFTWARE"
  | "CUENTA_DIGITAL"
  | "CONTENIDO_CREATIVO"
  | "CRIPTO"
  | "SERVICIO";

export type Role = "BUYER" | "SELLER";

export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
  doneBy?: string;
  doneAt?: number;
}

export interface EscrowMessage {
  id: string;
  escrowId: string;
  sender: string;       // wallet
  senderAlias: string;
  senderRole: Role | "BOT";
  text: string;
  ts: number;
  hash: string;         // SHA-256 del contenido previo + este mensaje
  immutable: boolean;   // true cuando escrow activo
  tag?: "ACUERDO" | "EVIDENCIA" | "URGENTE" | "SISTEMA";
}

export interface DisputeEvent {
  ts: number;
  level: 1 | 2 | 3;
  by: string;
  reason: string;
  evidence?: string;
}

export interface EscrowTx {
  id: string;            // ESC-YYYY-NNNNN
  phase: EscrowPhase;
  productType: ProductType;
  title: string;
  description: string;
  category: string;
  amount: number;        // USDT
  currency: string;      // "USDT"
  commissionPct: number; // 2
  buyer?: string;
  buyerAlias?: string;
  seller?: string;
  sellerAlias?: string;
  // Acuerdo mutuo
  agreement?: string;
  agreementLockedAt?: number;
  // Fondos
  fundedAt?: number;
  // Entrega
  deliveredAt?: number;
  deliveryPayload?: {
    description: string;
    code?: string;
    credentials?: string;
    link?: string;
    instructions?: string;
    fileHash?: string;       // SHA256
    licenseKey?: string;
    network?: string;
    tokenId?: string;
    txHash?: string;
  };
  // Verificación
  checklist: ChecklistItem[];
  inspectionDeadline?: number;  // 48h tras entrega
  // Disputa
  dispute?: {
    openedAt: number;
    level: 1 | 2 | 3;
    reason: string;
    events: DisputeEvent[];
    proposedPartial?: { seller: number; refund: number };
  };
  // Lifecycle
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  cancelledAt?: number;
  archivedAt?: number;
  // Log de eventos (audit trail)
  events: { ts: number; type: string; by: string; meta?: any }[];
}

// ---- Checklists por tipo de producto ------------------------
export const CHECKLISTS: Record<ProductType, { id: string; label: string }[]> = {
  SOFTWARE: [
    { id: "file", label: "Archivo entregado (hash SHA256)" },
    { id: "key", label: "Key/licencia visible y formato válido" },
    { id: "activation", label: "Screenshot de activación exitosa o código funcionando" },
    { id: "instructions", label: "Instrucciones de instalación incluidas" },
    { id: "malware", label: "Sin malware detectado (si aplica escaneo)" },
    { id: "rights", label: "Transferencia de derechos documentada (si aplica)" },
  ],
  CUENTA_DIGITAL: [
    { id: "creds", label: "Credenciales actuales entregadas (usuario/contraseña)" },
    { id: "email", label: "Email de recuperación cambiado o transferido" },
    { id: "2fa", label: "2FA desactivado o transferido correctamente" },
    { id: "panel", label: "Screenshot del panel mostrando estado premium/activo" },
    { id: "devices", label: "Sin dispositivos vinculados extraños" },
    { id: "warranty", label: "Garantía de no reclamo post-venta (24h mínimo)" },
  ],
  CONTENIDO_CREATIVO: [
    { id: "source", label: "Archivos fuente entregados (PSD, AI, AE, etc.)" },
    { id: "assets", label: "Fuentes/assets externos listados" },
    { id: "rights", label: "Derechos de uso especificados (personal/comercial)" },
    { id: "quality", label: "Calidad verificada (resolución, no watermark ajeno)" },
    { id: "layers", label: "Revisión de capas/elementos editables" },
    { id: "format", label: "Formato de entrega correcto" },
  ],
  CRIPTO: [
    { id: "wallet", label: "Dirección de wallet verificada" },
    { id: "tokenid", label: "Token ID / TX hash visible en explorer" },
    { id: "contract", label: "Smart contract verificado (si aplica)" },
    { id: "gas", label: "Gas fees cubiertos por vendedor (transferencia)" },
    { id: "metadata", label: "Metadata correcta del activo" },
    { id: "confirm", label: "Transferencia en blockchain confirmada" },
  ],
  SERVICIO: [
    { id: "duration", label: "Duración restante verificada" },
    { id: "owner", label: "Transferencia de owner en plataforma oficial" },
    { id: "strikes", label: "Sin strikes/penalizaciones en la cuenta" },
    { id: "renewal", label: "Método de renovación especificado" },
    { id: "access", label: "Acceso inmediato confirmado" },
    { id: "region", label: "Compatibilidad con región del comprador" },
  ],
};

export const PRODUCT_TYPE_LABELS: Record<ProductType, { label: string; emoji: string }> = {
  SOFTWARE: { label: "Software / Licencia / Código", emoji: "💻" },
  CUENTA_DIGITAL: { label: "Cuenta Digital (streaming, juegos, redes)", emoji: "🎮" },
  CONTENIDO_CREATIVO: { label: "Contenido Creativo (diseño, video, audio, docs)", emoji: "🎨" },
  CRIPTO: { label: "Criptoactivo / NFT / Dominio", emoji: "⛓️" },
  SERVICIO: { label: "Servicio / Suscripción / Créditos", emoji: "🔔" },
};

export const PHASE_LABELS: Record<EscrowPhase, { label: string; color: string }> = {
  NEGOCIANDO:        { label: "Negociando",            color: "text-slate-300 bg-slate-700/30 border-slate-600/30" },
  FONDOS_BLOQUEADOS: { label: "Fondos bloqueados",     color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  EN_VERIFICACION:   { label: "En verificación",       color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  COMPLETADA:        { label: "Completada",            color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  DISPUTA_N1:        { label: "Disputa Nivel 1",       color: "text-orange-400 bg-orange-500/10 border-orange-500/30" },
  DISPUTA_N2:        { label: "Disputa Nivel 2",       color: "text-red-400 bg-red-500/10 border-red-500/30" },
  DISPUTA_N3:        { label: "Disputa Nivel 3",       color: "text-rose-500 bg-rose-500/10 border-rose-500/30" },
  CANCELADA:         { label: "Cancelada",             color: "text-slate-500 bg-slate-700/30 border-slate-600/30" },
};

// ---- Anti-fraude: patrones de evasión -----------------------
export const EVASION_PATTERNS = [
  /\bhablamos por fuera\b/i,
  /\bahorremos comisi[óo]n\b/i,
  /\bdirecto sin escrow\b/i,
  /\bte paso mi\s*(whatsapp|telegram|ig|instagram|email|correo|tel[ée]fono|n[úu]mero)\b/i,
  /\b(?:whatsapp|telegram|ig|instagram)\s*[:@]\s*[\w.]+\b/i,
  /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/i,                          // email
  /\+\d{1,3}[\s-]?\d{6,}/,                                   // teléfono internacional
  /\b\d{3}[\s-]?\d{3}[\s-]?\d{4}\b/,                          // teléfono
];

// ---- Prohibido absoluto --------------------------------------
export const FORBIDDEN_PATTERNS = [
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4}\b/,           // tarjeta
  /\b\d{3}\s*\d{2}\s*\d{4}\s*\d{4}\b/,                       // tarjeta tipo banco
  /\bCVV\b/i,
  /\bCVC\b/i,
];
