// ============================================================
// CATÁLOGO DE PAÍSES Y MÉTODOS DE PAGO
// ============================================================
// Datos extraídos de la API de Binance P2P (2026-07-25).
// Los métodos de pago son los tradeMethodShortName exactos que
// devuelve la API. Para filtrar anuncios por método, pasar como
// payTypes en Binance o paymentMethod en OKX.
// ============================================================

export interface CountryConfig {
  code: string;        // "CO"
  name: string;        // "Colombia"
  flag: string;        // "🇨🇴"
  fiat: string;        // "COP"
  paymentMethods: { id: string; name: string }[];
}

export const COUNTRIES: CountryConfig[] = [
  {
    code: "CO",
    name: "Colombia",
    flag: "🇨🇴",
    fiat: "COP",
    paymentMethods: [
      { id: "Nequi", name: "Nequi" },
      { id: "Davivienda S.A", name: "Davivienda" },
      { id: "Bancolombia S.A", name: "Bancolombia" },
      { id: "Daviplata", name: "Daviplata" },
      { id: "Bre-B Keys", name: "Bre-B Keys" },
    ],
  },
  {
    code: "AR",
    name: "Argentina",
    flag: "🇦🇷",
    fiat: "ARS",
    paymentMethods: [
      { id: "Mercadopago", name: "Mercadopago" },
      { id: "Uala", name: "Uala" },
      { id: "BBVA", name: "BBVA" },
      { id: "Santander", name: "Santander" },
      { id: "Lemon Cash", name: "Lemon Cash" },
      { id: "Naranja X", name: "Naranja X" },
      { id: "Personal Pay", name: "Personal Pay" },
      { id: "Belo app", name: "Belo app" },
      { id: "Fiwind", name: "Fiwind" },
      { id: "Banco del Sol", name: "Banco del Sol" },
      { id: "BankArgentina", name: "BankArgentina" },
      { id: "Bank Transfer", name: "Bank Transfer" },
    ],
  },
  {
    code: "BR",
    name: "Brasil",
    flag: "🇧🇷",
    fiat: "BRL",
    paymentMethods: [
      { id: "Pix", name: "Pix" },
      { id: "Itaú", name: "Itaú" },
      { id: "Bradesco", name: "Bradesco" },
      { id: "Banco do Brasil", name: "Banco do Brasil" },
      { id: "Nubank", name: "Nubank" },
      { id: "Caixa", name: "Caixa" },
    ],
  },
  {
    code: "MX",
    name: "México",
    flag: "🇲🇽",
    fiat: "MXN",
    paymentMethods: [
      { id: "BBVA", name: "BBVA" },
      { id: "Citibanamex", name: "Citibanamex" },
      { id: "Santander Mexico", name: "Santander Mexico" },
      { id: "Banorte", name: "Banorte" },
      { id: "Mercadopago", name: "Mercadopago" },
      { id: "STP", name: "STP" },
      { id: "Cash Deposit to Bank", name: "Cash Deposit to Bank" },
      { id: "Bank Transfer", name: "Bank Transfer" },
    ],
  },
  {
    code: "EU",
    name: "Europa",
    flag: "🇪🇺",
    fiat: "EUR",
    paymentMethods: [
      { id: "BBVA", name: "BBVA" },
      { id: "Banco Santander (Spain)", name: "Banco Santander" },
      { id: "CaixaBank (Spain)", name: "CaixaBank" },
      { id: "N26", name: "N26" },
      { id: "SEPA", name: "SEPA" },
      { id: "SEPA Instant", name: "SEPA Instant" },
      { id: "Wise", name: "Wise" },
      { id: "Skrill", name: "Skrill" },
      { id: "Bank Transfer", name: "Bank Transfer" },
    ],
  },
  {
    code: "US",
    name: "Estados Unidos",
    flag: "🇺🇸",
    fiat: "USD",
    paymentMethods: [
      { id: "Bank Transfer", name: "Bank Transfer" },
      { id: "Wise", name: "Wise" },
      { id: "Skrill", name: "Skrill" },
      { id: "AirTM", name: "AirTM" },
      { id: "GrabrFi", name: "GrabrFi" },
    ],
  },
];

export function getCountryByCode(code: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.code === code.toUpperCase());
}

export function getCountryByFiat(fiat: string): CountryConfig | undefined {
  return COUNTRIES.find((c) => c.fiat === fiat.toUpperCase());
}

// ============================================================
// FEES DE RETIRO CRYPTO (FLAT, en unidades del asset)
// ============================================================
// Fuente: páginas oficiales de fees de cada exchange (Sept 2024)
// Para USDT siempre TRC20 (más barato y estándar)
// ============================================================

export const WITHDRAWAL_FEES: Record<string, Record<string, number>> = {
  Binance: { USDT: 1.0, BTC: 0.00005, ETH: 0.0016, SOL: 0.005, USDC: 1.0, BNB: 0.005 },
  OKX: { USDT: 1.0, BTC: 0.00004, ETH: 0.0016, SOL: 0.005, USDC: 1.0, BNB: 0.005 },
  Bybit: { USDT: 1.0, BTC: 0.00005, ETH: 0.002, SOL: 0.005, USDC: 1.0, BNB: 0.005 },
  Kraken: { USDT: 1.0, BTC: 0.00015, ETH: 0.0026, SOL: 0.01, USDC: 1.0, BNB: 0.005 },
};

export function getWithdrawalFee(exchange: string, asset: string): number {
  return WITHDRAWAL_FEES[exchange]?.[asset.toUpperCase()] ?? 1.0;
}

// ============================================================
// ASSETS SOPORTADOS
// ============================================================
export const SUPPORTED_ASSETS = ["USDT", "BTC", "ETH", "BNB", "SOL", "USDC"];
