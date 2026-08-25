import { NextRequest, NextResponse } from "next/server";

// GET /api/bitcoin?address=bc1...&op=balance
// GET /api/bitcoin?address=bc1...&op=utxos
// GET /api/bitcoin?address=bc1...&op=txs
// GET /api/bitcoin?op=fees
// GET /api/bitcoin?op=price
//
// Lee datos reales on-chain de Bitcoin vía Blockstream/mempool APIs.
// Backend para evitar CORS del navegador.

const BLOCKSTREAM_API = "https://blockstream.info/api";
const MEMPOOL_API = "https://mempool.space/api";

function isBitcoinAddress(addr: string): boolean {
  return (
    /^bc1[a-z0-9]{39,59}$/i.test(addr) ||
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get("address");
  const op = searchParams.get("op") || "balance";

  try {
    // Operaciones sin dirección
    if (op === "fees") {
      try {
        const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            fastest: data.fastestFee,
            halfHour: data.halfHourFee,
            hour: data.hourFee,
            minimum: data.minimumFee,
            source: "mempool.space",
          });
        }
      } catch (e) {
        console.warn("[bitcoin] mempool fees failed:", e);
      }
      return NextResponse.json({
        fastest: 30,
        halfHour: 25,
        hour: 20,
        minimum: 10,
        source: "fallback (mempool no disponible)",
      });
    }

    if (op === "price") {
      // Intentar Chainlink BTC/USD primero
      try {
        const priceRes = await fetch(
          `http://localhost:3000/api/price?pair=BTC/USD`
        );
        if (priceRes.ok) {
          const priceData = await priceRes.json();
          if (priceData.price) {
            return NextResponse.json({
              price: priceData.price,
              updatedAt: priceData.updatedAt,
              source: "chainlink",
            });
          }
        }
      } catch (e) {
        console.warn("[bitcoin] chainlink price failed:", e);
      }
      // Intentar mempool
      try {
        const res = await fetch(`${MEMPOOL_API}/v1/prices`, {
          signal: AbortSignal.timeout(8000),
        });
        if (res.ok) {
          const data = await res.json();
          return NextResponse.json({
            price: data.USD,
            updatedAt: Math.floor(Date.now() / 1000),
            source: "mempool.space",
          });
        }
      } catch (e) {
        console.warn("[bitcoin] mempool price failed:", e);
      }
      return NextResponse.json({
        price: 78000,
        updatedAt: Math.floor(Date.now() / 1000),
        source: "fallback (aproximado)",
      });
    }

    // Operaciones que requieren dirección
    if (!address) {
      return NextResponse.json(
        { error: "address requerido para esta operación" },
        { status: 400 }
      );
    }

    if (!isBitcoinAddress(address)) {
      return NextResponse.json(
        { error: `Dirección Bitcoin inválida: ${address.slice(0, 20)}…` },
        { status: 400 }
      );
    }

    if (op === "balance") {
      const res = await fetch(`${BLOCKSTREAM_API}/address/${address}`);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Blockstream API error: ${res.status}` },
          { status: res.status }
        );
      }
      const data = await res.json();
      const funded = data.chain_stats?.funded_txo_sum || 0;
      const spent = data.chain_stats?.spent_txo_sum || 0;
      const mempoolFunded = data.mempool_stats?.funded_txo_sum || 0;
      const mempoolSpent = data.mempool_stats?.spent_txo_sum || 0;
      return NextResponse.json({
        address,
        confirmed: funded - spent,
        unconfirmed: mempoolFunded - mempoolSpent,
        total: funded - spent + mempoolFunded - mempoolSpent,
        totalTx: data.chain_stats?.tx_count || 0,
        source: "blockstream.info",
      });
    }

    if (op === "utxos") {
      const res = await fetch(`${BLOCKSTREAM_API}/address/${address}/utxo`);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Blockstream UTXO API error: ${res.status}` },
          { status: res.status }
        );
      }
      const utxos = await res.json();
      return NextResponse.json({
        address,
        utxos,
        count: utxos.length,
        totalSats: utxos.reduce((s: number, u: { value: number }) => s + u.value, 0),
        source: "blockstream.info",
      });
    }

    if (op === "txs") {
      const res = await fetch(`${BLOCKSTREAM_API}/address/${address}/txs`);
      if (!res.ok) {
        return NextResponse.json(
          { error: `Blockstream txs API error: ${res.status}` },
          { status: res.status }
        );
      }
      const txs = await res.json();
      return NextResponse.json({
        address,
        transactions: txs.slice(0, 20),
        total: txs.length,
        source: "blockstream.info",
      });
    }

    return NextResponse.json(
      { error: `Operación no soportada: ${op}` },
      { status: 400 }
    );
  } catch (err) {
    console.error("[bitcoin API]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}

// POST /api/bitcoin?op=broadcast
// Body: { txHex: "020000..." }
export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");

  if (op === "broadcast") {
    try {
      const body = await req.json();
      const txHex = body.txHex;
      if (!txHex) {
        return NextResponse.json(
          { error: "txHex requerido en el body" },
          { status: 400 }
        );
      }
      const res = await fetch(`${BLOCKSTREAM_API}/tx`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: txHex,
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Broadcast error: ${errText}` },
          { status: res.status }
        );
      }
      const txid = await res.text();
      return NextResponse.json({
        txid,
        message: `Tx ${txid} broadcasteada. Pendiente de confirmación.`,
        explorerURL: `https://mempool.space/tx/${txid}`,
      });
    } catch (err) {
      return NextResponse.json(
        { error: "Error broadcasteando: " + (err as Error).message },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: `Operación POST no soportada: ${op}` },
    { status: 400 }
  );
}
