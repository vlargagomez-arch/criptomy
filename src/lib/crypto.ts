// Utilidades de cifrado E2E para mensajes entre partes.
// En MVP: usamos Web Crypto API (SubtleCrypto) con claves ECDH P-256.
// En producción: NaCl (X25519 + XSalsa20-Poly1305) vía libsodium-wrappers.

export interface KeyPair {
  publicKey: string; // base64
  privateKey: string; // base64 - se guarda en localStorage, NUNCA en servidor
}

// Genera par de claves ECDH (P-256) en el navegador
export async function generateKeyPair(): Promise<KeyPair> {
  const kp = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  );

  const pub = await crypto.subtle.exportKey("spki", kp.publicKey);
  const priv = await crypto.subtle.exportKey("pkcs8", kp.privateKey);

  return {
    publicKey: bufToBase64(pub),
    privateKey: bufToBase64(priv),
  };
}

// Cifra un mensaje con la clave pública del destinatario
export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderPrivateKeyB64: string
): Promise<{ ciphertext: string; nonce: string }> {
  const recipientPubKey = await crypto.subtle.importKey(
    "spki",
    base64ToBuf(recipientPublicKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const senderPrivKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToBuf(senderPrivateKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );

  // Derivar clave AES-GCM compartida
  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: recipientPubKey },
    senderPrivKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    sharedKey,
    new TextEncoder().encode(plaintext)
  );

  return {
    ciphertext: bufToBase64(ct),
    nonce: bufToBase64(iv),
  };
}

// Descifra un mensaje recibido
export async function decryptMessage(
  ciphertextB64: string,
  nonceB64: string,
  senderPublicKeyB64: string,
  recipientPrivateKeyB64: string
): Promise<string> {
  const senderPubKey = await crypto.subtle.importKey(
    "spki",
    base64ToBuf(senderPublicKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const recipientPrivKey = await crypto.subtle.importKey(
    "pkcs8",
    base64ToBuf(recipientPrivateKeyB64),
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );

  const sharedKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: senderPubKey },
    recipientPrivKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuf(nonceB64) },
    sharedKey,
    base64ToBuf(ciphertextB64)
  );

  return new TextDecoder().decode(pt);
}

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

// Hash simple para fingerprints legibles (no criptográficamente seguro)
export function shortFingerprint(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// Genera alias pseudónimo aleatorio estilo "satoshi_ninja_42"
const ADJETIVOS = [
  "satoshi", "cyber", "crypto", "shadow", "ghost", "neon", "luna",
  "astro", "pixel", "quantic", "atlas", "nova", "zen", "kai",
];
const SUSTANTIVOS = [
  "trader", "ninja", "wolf", "fox", "tiger", "hawk", "bear", "lion",
  "phoenix", "raven", "cobra", "panther", "dragon", "falcon",
];

export function randomAlias(): string {
  const a = ADJETIVOS[Math.floor(Math.random() * ADJETIVOS.length)];
  const s = SUSTANTIVOS[Math.floor(Math.random() * SUSTANTIVOS.length)];
  const n = Math.floor(Math.random() * 99);
  return `${a}_${s}_${n}`;
}
