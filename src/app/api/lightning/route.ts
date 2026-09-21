import { NextRequest, NextResponse } from "next/server";

// GET /api/lightning?op=decode&invoice=lnbc...
// POST /api/lightning?op=invoice { amount, description }
// POST /api/lightning?op=pay { invoice }

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");

  if (op === "decode") {
    const invoice = searchParams.get("invoice");
    if (!invoice) {
      return NextResponse.json({ error: "invoice requerido" }, { status: 400 });
    }
    // Decodificar BOLT11 (parse básico)
    if (!invoice.startsWith("lnbc")) {
      return NextResponse.json({ error: "No es un invoice BOLT11 válido" }, { status: 400 });
    }
    const amountMatch = invoice.match(/lnbc(\d+)([munp]?)/);
    let amountSats = 0;
    if (amountMatch) {
      const num = parseInt(amountMatch[1]);
      const unit = amountMatch[2];
      const satMult: Record<string, number> = {
        "": 1,
        m: 100000000,
        u: 100000,
        n: 0.1,
        p: 0.0001,
      };
      amountSats = Math.floor(num * satMult[unit]);
    }
    return NextResponse.json({
      amountSats,
      valid: true,
      timestamp: Math.floor(Date.now() / 1000),
      expiry: 3600,
    });
  }

  if (op === "price") {
    // Precio BTC vía Chainlink
    try {
      const priceRes = await fetch("http://localhost:3000/api/price?pair=BTC/USD");
      const priceData = await priceRes.json();
      return NextResponse.json({
        btcUSD: priceData.price,
        satsUSD: priceData.price / 100_000_000,
        source: "chainlink",
      });
    } catch {
      return NextResponse.json({ btcUSD: 78000, satsUSD: 0.00078, source: "fallback" });
    }
  }

  return NextResponse.json({ error: `Operación no soportada: ${op}` }, { status: 400 });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");
  const body = await req.json();

  if (op === "invoice") {
    // Generar invoice mock (en producción: llamar a LND/OpenNode)
    const { amount, description } = body;
    if (!amount || amount < 1) {
      return NextResponse.json({ error: "amount (sats) requerido, mínimo 1" }, { status: 400 });
    }
    const paymentHash = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const timestamp = Math.floor(Date.now() / 1000);
    const invoice = `lnbc${amount}n1p${paymentHash.slice(0, 20)}1q${paymentHash.slice(20, 28)}`;
    return NextResponse.json({
      paymentHash,
      paymentRequest: invoice,
      amountSats: amount,
      description: description || "",
      createdAt: timestamp,
      expiresAt: timestamp + 3600,
      status: "pending",
      note: "Invoice mock. En producción: usar LND, OpenNode o LNBits.",
    });
  }

  if (op === "pay") {
    // Simular pago (en producción: llamar a LND/OpenNode)
    const { invoice } = body;
    if (!invoice) {
      return NextResponse.json({ error: "invoice requerido" }, { status: 400 });
    }
    return NextResponse.json({
      status: "paid",
      preimage: Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      paymentHash: Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      note: "Pago simulado. En producción: requiere nodo Lightning real.",
    });
  }

  return NextResponse.json({ error: `Operación no soportada: ${op}` }, { status: 400 });
}
