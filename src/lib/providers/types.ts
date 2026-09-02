// ============================================================
// INTERFACES DE PROVIDERS — Capa de abstracción
// ============================================================
// Toda la UI habla con estas interfaces, NUNCA con el provider directo.
// Cambiar adapter = cambiar provider sin tocar la UI.
// ============================================================

// ============================================================
// WALLET PROVIDER — Conexión de billeteras Web3
// ============================================================
export interface WalletProvider {
  readonly id: string;                  // "metamask", "walletconnect", ...
  readonly name: string;
  readonly icon: string;               // URL o emoji
  readonly description: string;
  readonly isInstalled: () => boolean | Promise<boolean>;
  readonly connect: () => Promise<WalletConnection>;
  readonly disconnect?: () => Promise<void>;
  readonly getNetworks: () => Promise<SupportedNetwork[]>;
  readonly switchNetwork: (chainIdHex: string) => Promise<void>;
  readonly onAccountsChanged?: (cb: (accounts: string[]) => void) => void;
  readonly onChainChanged?: (cb: (chainIdHex: string) => void) => void;
}

export interface WalletConnection {
  address: string;
  chainId: string;        // hex string "0x89" para Polygon
  provider: string;       // id del provider
}

// ============================================================
// MARKET DATA PROVIDER — Precios en tiempo real
// ============================================================
export interface MarketDataProvider {
  readonly id: string;                  // "chainlink", "coingecko", ...
  readonly name: string;
  readonly getPrice: (asset: string, currency: string) => Promise<PriceQuote | null>;
  readonly getMultiplePrices: (assets: string[], currency: string) => Promise<Record<string, PriceQuote | null>>;
  readonly supportedAssets: () => string[];
}

export interface PriceQuote {
  asset: string;
  currency: string;
  price: number;
  source: string;
  updatedAt: number;       // timestamp seconds
}

// ============================================================
// ON-RAMP PROVIDER — Comprar cripto con fiat
// ============================================================
export interface OnRampProvider {
  readonly id: string;                  // "moonpay", "transak", "ramp", ...
  readonly name: string;
  readonly logoUrl?: string;
  readonly countries: string[];         // ISO 3166-1 alpha-2 ("CO", "MX", ...)
  readonly requiresKyc: boolean;

  // Consultar disponibilidad para un caso de uso concreto
  readonly isAvailable: (req: AvailabilityRequest) => Promise<AvailabilityResponse>;

  // Iniciar flujo de compra (devuelve URL a redirigir o SDK a montar)
  readonly startPurchase: (req: PurchaseRequest) => Promise<PurchaseResponse>;

  // Consultar estado de una compra
  readonly getPurchaseStatus: (purchaseId: string) => Promise<PurchaseStatus>;
}

// ============================================================
// OFF-RAMP PROVIDER — Vender cripto, recibir fiat
// ============================================================
export interface OffRampProvider {
  readonly id: string;
  readonly name: string;
  readonly logoUrl?: string;
  readonly countries: string[];
  readonly requiresKyc: boolean;

  readonly isAvailable: (req: AvailabilityRequest) => Promise<AvailabilityResponse>;
  readonly startSell: (req: SellRequest) => Promise<SellResponse>;
  readonly getSellStatus: (sellId: string) => Promise<SellStatus>;
}

// ============================================================
// CARD PROVIDER — Tarjetas crypto (siempre tercerizado)
// ============================================================
export interface CardProvider {
  readonly id: string;                  // "crypto.com", "wirex", ...
  readonly name: string;
  readonly logoUrl?: string;
  readonly countries: string[];
  readonly requiresKyc: boolean;
  readonly cardTypes: ("VIRTUAL" | "PHYSICAL")[];

  readonly isAvailable: (req: AvailabilityRequest) => Promise<AvailabilityResponse>;
  readonly requestCard: (req: CardRequest) => Promise<CardResponse>;
  readonly getCardStatus: (cardId: string) => Promise<CardStatus>;
}

// ============================================================
// REMITTANCE PROVIDER — Transferencias cross-border
// ============================================================
export interface RemittanceProvider {
  readonly id: string;
  readonly name: string;
  readonly logoUrl?: string;
  readonly countries: string[];        // países destino soportados
  readonly requiresKyc: boolean;

  readonly isAvailable: (req: AvailabilityRequest) => Promise<AvailabilityResponse>;
  readonly startRemittance: (req: RemittanceRequest) => Promise<RemittanceResponse>;
  readonly getRemittanceStatus: (id: string) => Promise<RemittanceStatus>;
}

// ============================================================
// Tipos compartidos
// ============================================================

export interface SupportedNetwork {
  chainId: string;        // hex "0x89"
  name: string;           // "Polygon"
  symbol: string;         // "MATIC"
  rpcUrl: string;
  explorerUrl: string;
}

export interface AvailabilityRequest {
  country: string;        // "CO"
  currency: string;       // "COP"
  crypto: string;         // "USDT"
  network: string;        // "POLYGON"
  amount: number;
  paymentMethod?: string; // "PSE", "CARD", "BANK_TRANSFER"
}

export interface AvailabilityResponse {
  available: boolean;
  reason?: string;        // si no available, por qué
  fee?: number;
  feeCurrency?: string;
  rate?: number;
  estimatedTime?: string;
  minAmount?: number;
  maxAmount?: number;
  kycRequired?: boolean;
}

export interface PurchaseRequest {
  crypto: string;
  network: string;
  amount: number;          // monto en fiat o crypto
  amountType: "FIAT" | "CRYPTO";
  currency: string;
  paymentMethod: string;
  walletAddress: string;
  country: string;
  redirectUrl?: string;
}

export interface PurchaseResponse {
  purchaseId: string;
  redirectUrl?: string;     // si requiere redirect
  sdkToken?: string;        // si usa SDK
  iframeUrl?: string;       // si usa iframe
  status: "PENDING" | "REDIRECT_REQUIRED" | "SDK_REQUIRED";
}

export interface PurchaseStatus {
  purchaseId: string;
  status: "PENDING" | "PAYMENT_RECEIVED" | "COMPLETED" | "FAILED" | "EXPIRED" | "CANCELLED";
  txHash?: string;
  cryptoAmount?: number;
  receivedAt?: number;
  error?: string;
}

export interface SellRequest {
  crypto: string;
  network: string;
  cryptoAmount: number;
  currency: string;          // moneda fiat a recibir
  paymentMethod: string;
  walletAddress: string;     // desde dónde enviará el crypto
  country: string;
  payoutDetails: {
    method: string;          // "BANK_TRANSFER", "PSE", "NEQUI"
    accountInfo: string;     // JSON con datos de la cuenta destino
  };
  redirectUrl?: string;
}

export interface SellResponse {
  sellId: string;
  redirectUrl?: string;
  depositAddress?: string;   // dirección donde el usuario debe enviar el crypto
  depositAmount?: number;
  status: "PENDING" | "AWAITING_DEPOSIT" | "REDIRECT_REQUIRED";
}

export interface SellStatus {
  sellId: string;
  status: "AWAITING_DEPOSIT" | "CONFIRMED" | "FIAT_SENT" | "COMPLETED" | "FAILED" | "EXPIRED";
  fiatAmount?: number;
  txHash?: string;
  completedAt?: number;
  error?: string;
}

export interface CardRequest {
  country: string;
  cardType: "VIRTUAL" | "PHYSICAL";
  kycToken?: string;        // si el usuario ya pasó KYC con el provider
  shippingAddress?: string;  // para tarjeta física
}

export interface CardResponse {
  cardId: string;
  status: "PENDING_KYC" | "PENDING_ISSUANCE" | "ISSUED" | "REJECTED";
  redirectUrl?: string;
}

export interface CardStatus {
  cardId: string;
  status: "ACTIVE" | "FROZEN" | "BLOCKED" | "EXPIRED";
  balance?: number;
  currency?: string;
  last4?: string;
  cardType: "VIRTUAL" | "PHYSICAL";
  supportsApplePay: boolean;
  supportsGooglePay: boolean;
}

export interface RemittanceRequest {
  fromCountry: string;
  toCountry: string;
  crypto: string;
  network: string;
  cryptoAmount: number;
  payoutCurrency: string;       // moneda que recibe el destinatario
  payoutMethod: string;         // "BANK_TRANSFER", "PICKUP", "WALLET"
  recipient: {
    name: string;
    accountInfo: string;        // JSON
  };
  senderWalletAddress: string;
}

export interface RemittanceResponse {
  remittanceId: string;
  status: "PENDING" | "AWAITING_DEPOSIT" | "REDIRECT_REQUIRED";
  redirectUrl?: string;
  depositAddress?: string;
  depositAmount?: number;
  estimatedDelivery?: string;
}

export interface RemittanceStatus {
  remittanceId: string;
  status: "AWAITING_DEPOSIT" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED";
  fiatAmount?: number;
  receivedBy?: string;
  completedAt?: number;
  error?: string;
}

// ============================================================
// REGISTRY — Catálogo central de providers activos
// ============================================================
export interface ProviderMetadata {
  id: string;
  name: string;
  category: "WALLET" | "ON_RAMP" | "OFF_RAMP" | "CARD" | "REMITTANCE" | "MARKET_DATA";
  logoUrl?: string;
  websiteUrl: string;
  documentationUrl?: string;
  countries: string[];
  cryptos: string[];
  networks: string[];
  kycRequired: boolean;
  isReal: boolean;          // false = MOCK (solo dev)
  isLive: boolean;          // false = no activado en producción todavía
  apiKeyRequired: boolean;
  integrationType: "SDK" | "REDIRECT" | "IFRAME" | "API";
  notes?: string;
}
