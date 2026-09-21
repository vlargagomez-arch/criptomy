import { NextResponse } from "next/server";
import {
  CHAINS,
  TOKENS,
  PAYMENT_METHODS,
  FIAT_CURRENCIES,
} from "@/lib/blockchain/config";

// GET /api/chain-config - devuelve config multi-chain, tokens y métodos de pago
export async function GET() {
  return NextResponse.json({
    chains: CHAINS,
    tokens: TOKENS,
    paymentMethods: PAYMENT_METHODS,
    fiatCurrencies: FIAT_CURRENCIES,
  });
}
