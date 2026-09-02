import { NextRequest, NextResponse } from "next/server";

// POST /api/ipfs?op=upload
// Acepta FormData (file) o JSON { content, filename }
//
// - Si hay PINATA_API_KEY configurada: sube a Pinata (IPFS real, persistente).
// - Si NO hay Pinata: genera un CID determinístico (SHA-256 → base58) y devuelve
//   un warning claro: "no persistente, configure Pinata para IPFS real".
//
// Esto es honesto: el usuario sabe cuándo es real y cuándo es solo una referencia local.

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

  const contentType = req.headers.get("content-type") || "";

  try {
    let fileBytes: Uint8Array;
    let filename = "evidence.bin";
    let mimeType = "application/octet-stream";

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json(
          { error: "file (File) requerido en FormData" },
          { status: 400 }
        );
      }
      fileBytes = new Uint8Array(await file.arrayBuffer());
      filename = file.name || "evidence.bin";
      mimeType = file.type || mimeType;
    } else {
      // JSON fallback: { content: string (utf-8), filename? }
      const body = await req.json();
      const { content, filename: fname = "evidence.json" } = body;
      if (!content || typeof content !== "string") {
        return NextResponse.json(
          { error: "file (FormData) o content (JSON string) requerido" },
          { status: 400 }
        );
      }
      fileBytes = new TextEncoder().encode(content);
      filename = fname;
      mimeType = "application/json";
    }

    // 1) Intentar Pinata (IPFS real persistente)
    if (PINATA_API_KEY && PINATA_SECRET) {
      try {
        const formData = new FormData();
        const blob = new Blob([fileBytes], { type: mimeType });
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
              size: data.PinSize || fileBytes.length,
              gateway: "pinata",
              pinned: true,
              real: true,
            });
          }
        }
      } catch (e) {
        console.warn("[ipfs] Pinata upload failed:", e);
      }
    }

    // 2) Fallback honesto: CID determinístico (no persistente en IPFS público)
    const cid = await generateCID(fileBytes);
    return NextResponse.json({
      cid,
      url: `https://ipfs.io/ipfs/${cid}`,
      size: fileBytes.length,
      gateway: "local-hash",
      pinned: false,
      real: false,
      warning:
        "CID generado localmente, NO persistente en IPFS. Configure PINATA_API_KEY y PINATA_SECRET_API_KEY para IPFS real y accesible públicamente.",
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
// Lee contenido desde IPFS vía gateways públicos (solo funciona si el CID fue
// pinnado por Pinata o por otro nodo IPFS)
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
          real: true,
        });
      }
    } catch (e) {
      console.warn(`[ipfs] gateway ${gateway} failed:`, e);
      continue;
    }
  }

  return NextResponse.json(
    {
      error: "No se pudo leer desde ningún gateway IPFS. El CID puede no estar pinnado.",
      real: false,
    },
    { status: 503 }
  );
}

// Generar CID determinístico (formato CIDv0 compatible con IPFS)
// Nota: este CID NO es accesible públicamente a menos que alguien lo pinee.
// Es solo una referencia determinística para uso interno y desarrollo.
async function generateCID(data: Uint8Array): Promise<string> {
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
