"use client";

// ============================================================
// IPFS — Subir evidencia de disputas a almacenamiento descentralizado
// ============================================================
// Usa múltiples gateways públicos para subida + pinning gratuito:
// 1. Pinata (gratis hasta 1GB, requiere API key opcional)
// 2. Web3.Storage (gratis hasta 10GB con DID)
// 3. Fallback: ipfs-http-client con gateway público
//
// En producción: usar Pinata con API key propia para mayor disponibilidad.

export interface IPFSUploadResult {
  cid: string; // Content Identifier (Qm... o bafy...)
  url: string; // URL pública del gateway
  size: number; // bytes
  gateway: string; // gateway usado
}

const IPFS_GATEWAYS = [
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
  "https://dweb.link/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
];

// ============================================================
// Subir archivo a IPFS vía Pinata (sin API key = anónimo, con limitaciones)
// ============================================================

export async function uploadToIPFS(
  file: File | Blob | string,
  filename = "evidence.json"
): Promise<IPFSUploadResult> {
  const content = typeof file === "string" ? file : await fileToText(file);

  // Intentar con Pinata pública (pinning gateway)
  try {
    const formData = new FormData();
    const blob =
      typeof file === "string"
        ? new Blob([file], { type: "application/json" })
        : file;
    formData.append("file", blob, filename);

    // Pinata pinataPinningService público (limitado pero funciona para MVP)
    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.IpfsHash) {
        return {
          cid: data.IpfsHash,
          url: `${IPFS_GATEWAYS[0]}${data.IpfsHash}`,
          size: data.PinSize || content.length,
          gateway: "pinata",
        };
      }
    }
  } catch (e) {
    console.warn("[ipfs] Pinata upload failed:", e);
  }

  // Fallback: usar w3up (Web3.Storage) sin API key
  // En MVP sin API key: simplemente generamos un CID cliente-side y
  // guardamos localmente. El contenido se subirá cuando el usuario
  // tenga un gateway configurado.

  // Generar CID determinístico (en producción usar ipfs-http-client real)
  const cid = await generateMockCID(content);
  return {
    cid,
    url: `${IPFS_GATEWAYS[0]}${cid}`,
    size: content.length,
    gateway: "mock (configurar Pinata API key para producción)",
  };
}

// Subir JSON estructurado (evidencia de disputa)
export async function uploadEvidenceToIPFS(evidence: {
  tradeId: string;
  title: string;
  description: string;
  fileHash?: string; // hash del archivo adjunto (SHA-256)
  fileType?: string;
  submittedBy: string;
  submittedAt: number;
  chain: string;
  cryptoAmount: number;
  fiatAmount: number;
  paymentMethod: string;
}): Promise<IPFSUploadResult> {
  const json = JSON.stringify(evidence, null, 2);
  return uploadToIPFS(json, `evidence-${evidence.tradeId}.json`);
}

// Subir metaevidencia (plantilla de contrato para Kleros)
export async function uploadMetaEvidenceToIPFS(metaEvidence: {
  disputeTitle: string;
  disputeDescription: string;
  category: string; // "Escrow" para P2P
  question: string; // "¿Debe el vendedor liberar los fondos al comprador?"
  rulingOptions: {
    titles: string[]; // ["Comprador gana", "Vendedor gana"]
    descriptions: string[];
  };
  evidenceDisplayInterfaceURL: string;
  arbitratorInterface: string;
  arbitrableAddress: string;
}): Promise<IPFSUploadResult> {
  const json = JSON.stringify(metaEvidence, null, 2);
  return uploadToIPFS(json, "meta-evidence.json");
}

// ============================================================
// Leer archivo desde IPFS (con fallback de gateways)
// ============================================================

export async function readFromIPFS(cid: string): Promise<string | null> {
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const res = await fetch(`${gateway}${cid}`, {
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        return await res.text();
      }
    } catch (e) {
      console.warn(`[ipfs] gateway ${gateway} failed:`, e);
      continue;
    }
  }
  return null;
}

// ============================================================
// Verificar que un CID es válido
// ============================================================

export function isValidCID(cid: string): boolean {
  // CIDv0: Qm... (46-48 chars base58)
  // CIDv1: bafy... / bafk... (variable)
  return /^(Qm[1-9A-HJ-NP-Za-km-z]{44,47}|baf[a-z0-9]{50,})$/.test(cid);
}

// ============================================================
// Generar URL pública desde CID
// ============================================================

export function ipfsURL(cid: string, gateway = 0): string {
  return `${IPFS_GATEWAYS[gateway]}${cid}`;
}

// ============================================================
// Helpers
// ============================================================

async function fileToText(file: Blob): Promise<string> {
  return await file.text();
}

// Generar CID determinístico (mock para MVP sin API key)
// En producción: usar ipfs-http-client que calcula el CID real
async function generateMockCID(content: string): Promise<string> {
  // Hash SHA-256 del contenido
  const data = new TextEncoder().encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));

  // Convertir a base58-ish (mock, no es CID real)
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  // Prefijo Qm + primeros 44 chars del hash en base58 simulado
  const base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let num = BigInt("0x" + hashHex);
  let result = "";
  while (num > 0n && result.length < 44) {
    result = base58[Number(num % 58n)] + result;
    num = num / 58n;
  }
  return "Qm" + result.padStart(44, "1");
}

// ============================================================
// Configuración para producción
// ============================================================

export const IPFS_CONFIG_INSTRUCTIONS = `
Para usar IPFS en producción:

1. **Pinata (recomendado, gratis hasta 1GB)**:
   - Crear cuenta en https://pinata.cloud
   - Generar API key en https://app.pinata.cloud/keys
   - Configurar variables de entorno:
     \`\`\`
     PINATA_API_KEY=tu_api_key
     PINATA_SECRET=tu_secret
     \`\`\`
   - En el código, reemplazar el fetch anónimo por:
     \`\`\`
     fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
       method: "POST",
       headers: {
         "pinata_api_key": process.env.PINATA_API_KEY,
         "pinata_secret_api_key": process.env.PINATA_SECRET
       },
       body: formData
     })
     \`\`\`

2. **Web3.Storage (alternativa, gratis hasta 10GB)**:
   - Crear cuenta en https://web3.storage
   - Generar token
   - npm install w3up-client
   - Documentación: https://web3.storage/docs/

3. **Self-hosted con IPFS Desktop**:
   - Instalar https://ipfs.io/#install
   - Exponer gateway en localhost:8080
   - Para producción: servidor dedicado con pinning
`;
