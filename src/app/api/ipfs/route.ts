import { NextRequest, NextResponse } from "next/server";

// POST /api/ipfs?op=upload
// Body: { content: string, filename?: string }
//
// Sube contenido a IPFS vía Pinata (con API key si está configurada)
// o fallback a gateway público.

const PINATA_API_KEY = process.env.PINATA_API_KEY;
const PINATA_SECRET = process.env.PINATA_SECRET_API_KEY;

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");

  if (op !== "upload") {
    return NextResponse.json(
      { error: `Operación no soportada: ${op}` },
      { status: 400 }
    );
  }

  try {
    const body = await req.json();
    const { content, filename = "evidence.json" } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "content (string) requerido" },
        { status: 400 }
      );
    }

    // Intentar con Pinata si hay API key configurada
    if (PINATA_API_KEY && PINATA_SECRET) {
      try {
        const formData = new FormData();
        const blob = new Blob([content], { type: "application/json" });
        formData.append("file", blob, filename);

        const res = await fetch(
          "https://api.pinata.cloud/pinning/pinFileToIPFS",
          {
            method: "POST",
            headers: {
              pinata_api_key: PINATA_API_KEY,
              pinata_secret_api_key: PINATA_SECRET,
            },
            body: formData,
          }
        );

        if (res.ok) {
          const data = await res.json();
          if (data.IpfsHash) {
            return NextResponse.json({
              cid: data.IpfsHash,
              url: `https://ipfs.io/ipfs/${data.IpfsHash}`,
              size: data.PinSize || content.length,
              gateway: "pinata",
              pinned: true,
            });
          }
        }
      } catch (e) {
        console.warn("[ipfs] Pinata upload failed:", e);
      }
    }

    // Fallback: usar ipfs-http-client con gateway público (no persiste pero genera CID)
    // Generamos el CID server-side para evitar inconsistencias
    const cid = await generateCID(content);
    return NextResponse.json({
      cid,
      url: `https://ipfs.io/ipfs/${cid}`,
      size: content.length,
      gateway: "mock-server-side",
      pinned: false,
      warning:
        "Archivo no pinnenado permanentemente. Configure PINATA_API_KEY y PINATA_SECRET_API_KEY para persistencia real.",
    });
  } catch (err) {
    console.error("[ipfs API]", err);
    return NextResponse.json(
      { error: "Error interno: " + (err as Error).message },
      { status: 500 }
    );
  }
}

// GET /api/ipfs?op=read&cid=Qm...
// Lee contenido desde IPFS vía gateway público (con fallback)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const op = searchParams.get("op");
  const cid = searchParams.get("cid");

  if (op !== "read" || !cid) {
    return NextResponse.json(
      { error: "op=read y cid son requeridos" },
      { status: 400 }
    );
  }

  const gateways = [
    "https://ipfs.io/ipfs/",
    "https://cloudflare-ipfs.com/ipfs/",
    "https://dweb.link/ipfs/",
    "https://gateway.pinata.cloud/ipfs/",
  ];

  for (const gateway of gateways) {
    try {
      const res = await fetch(`${gateway}${cid}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const text = await res.text();
        return NextResponse.json({
          cid,
          content: text,
          gateway: gateway.split("//")[1].split("/")[0],
          size: text.length,
        });
      }
    } catch (e) {
      console.warn(`[ipfs] gateway ${gateway} failed:`, e);
      continue;
    }
  }

  return NextResponse.json(
    { error: "No se pudo leer desde ningún gateway IPFS" },
    { status: 503 }
  );
}

// Generar CID server-side (en MVP, mock determinístico)
async function generateCID(content: string): Promise<string> {
  // En producción: usar import('ipfs-http-client') y calcular el CID real
  // Aquí generamos un hash determinístico para consistencia
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + hashHex);
  let result = "";
  while (num > 0n && result.length < 44) {
    result = base58[Number(num % 58n)] + result;
    num = num / 58n;
  }
  return "Qm" + result.padStart(44, "1");
}
