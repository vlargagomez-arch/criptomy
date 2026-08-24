"use client";

// ============================================================
// Bitcoin Electrum client — leer saldos y UTXOs sin nodo completo
// ============================================================
// Usa el protocolo Electrum (1.4) para conectarse a servidores públicos.
// Para broadcast de txs en producción: usar un servicio como mempool.space API.
//
// Documentación: https://electrumx.readthedocs.io/
// Lista de servidores públicos: https://1209ks1c0c7acab6fr1l1lm6at1uf5adv6gm0b9o3ip1i1lrbk1l.publicnode.com/status

interface ElectrumBalance {
  confirmed: number; // satoshis
  unconfirmed: number; // satoshis
}

interface ElectrumUTXO {
  tx_hash: string;
  tx_pos: number;
  value: number; // satoshis
  height: number;
}

const ELECTRUM_SERVERS = [
  { host: "electrum.blockstream.info", port: 50001, ssl: false },
  { host: "electrum.bitaroo.net", port: 50001, ssl: false },
  { host: "fortress.qtornado.com", port: 50001, ssl: false },
  { host: "electrum.acinq.co", port: 50001, ssl: false },
];

// En lugar de implementar el protocolo Electrum completo desde cero,
// usamos la API REST de Blockstream (basada en electrum server) que es más simple
// y no requiere mantener una conexión TCP persistente.

const BLOCKSTREAM_API = "https://blockstream.info/api";
const MEMPOOL_API = "https://mempool.space/api";

// ============================================================
// Lectura de saldo BTC (vía API REST)
// ============================================================

export async function getBitcoinBalance(address: string): Promise<{
  confirmed: number;
  unconfirmed: number;
  total: number;
  address: string;
}> {
  // Validar que es una dirección Bitcoin
  if (!isBitcoinAddress(address)) {
    throw new Error(`Dirección Bitcoin inválida: ${address.slice(0, 20)}…`);
  }

  const url = `${BLOCKSTREAM_API}/address/${address}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Blockstream API error: ${res.status}`);
  }
  const data = await res.json();
  const confirmed = data.chain_stats?.funded_txo_sum || 0;
  const spent = data.chain_stats?.spent_txo_sum || 0;
  const unconfirmed = data.mempool_stats?.funded_txo_sum || 0;
  return {
    confirmed: confirmed - spent,
    unconfirmed,
    total: confirmed - spent + unconfirmed,
    address,
  };
}

// ============================================================
// Leer UTXOs de una dirección
// ============================================================

export async function getBitcoinUTXOs(address: string): Promise<ElectrumUTXO[]> {
  const url = `${BLOCKSTREAM_API}/address/${address}/utxo`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Blockstream UTXO API error: ${res.status}`);
  }
  const data = (await res.json()) as ElectrumUTXO[];
  return data;
}

// ============================================================
// Obtener historial de transacciones
// ============================================================

export interface BitcoinTx {
  txid: string;
  status: {
    confirmed: boolean;
    block_height?: number;
    block_time?: number;
  };
  vin: Array<{ prevout: { value: number; scriptpubkey_address: string } }>;
  vout: Array<{ value: number; scriptpubkey_address: string }>;
  fee: number;
}

export async function getBitcoinTxHistory(address: string): Promise<BitcoinTx[]> {
  const url = `${BLOCKSTREAM_API}/address/${address}/txs`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Blockstream txs API error: ${res.status}`);
  }
  return res.json();
}

// ============================================================
// Broadcast de transacción firmada (hex)
// ============================================================

export async function broadcastBitcoinTx(signedTxHex: string): Promise<string> {
  const res = await fetch(`${BLOCKSTREAM_API}/tx`, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: signedTxHex,
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Broadcast error: ${err}`);
  }
  return res.text(); // txid
}

// ============================================================
// Crear dirección de escrow HTLC (Hash Time-Locked Contract)
// ============================================================
// En Bitcoin P2P sin KYC, el escrow se implementa con HTLC:
// - Vendedor crea HTLC con hash de preimagen
// - Comprador revela la preimagen al reclamar (revela identidad on-chain)
// - Si no reclama en T horas, el vendedor recupera
//
// En MVP no generamos el script P2SH real (requiere bitcoinjs-lib),
// pero exponemos el helper conceptual.

export interface HTLCParams {
  seller: string; // Bitcoin address
  buyer: string; // Bitcoin address
  hashlock: string; // SHA256 hash hex de la preimagen
  timelockBlocks: number; // bloques hasta que el vendedor puede reclamar
}

export function computeHTLCHashlock(secret: string): string {
  // En producción: usar bitcoinjs-lib + crypto.subtle
  // Aquí solo demostramos la interfaz
  return `sha256(${secret.slice(0, 16)}…)`;
}

export async function createHTLCEscrow(params: HTLCParams): Promise<{
  escrowScript: string;
  escrowAddress: string;
  hashlock: string;
  instructions: string;
}> {
  // En producción con bitcoinjs-lib:
  // const script = htlcScript(seller, buyer, params.hashlock, params.timelockBlocks)
  // const p2sh = bitcoin.payments.p2sh({ redeem: { output: script } })

  // MVP: devolver instrucciones
  return {
    escrowScript: `(HTLC script P2SH - requires bitcoinjs-lib to generate)`,
    escrowAddress: `Generar con bitcoinjs-lib`,
    hashlock: params.hashlock,
    instructions: `Para implementar HTLC real:
1. npm install bitcoinjs-lib @noble/hashes
2. Crear script: OP_IF OP_SHA256 <hashlock> OP_EQUALVERIFY <buyer_pubkey> OP_CHECKSIG OP_ELSE <timelock> OP_CHECKSEQUENCEVERIFY OP_DROP <seller_pubkey> OP_CHECKSIG OP_ENDIF
3. Generar P2SH address
4. Vendedor envía BTC a la P2SH address
5. Comprador revela preimagen para reclamar
6. Tras timelock, vendedor puede recuperar`,
  };
}

// ============================================================
// Helpers
// ============================================================

export function isBitcoinAddress(addr: string): boolean {
  // Bech32 (bc1...) o Base58 (1... o 3...)
  return (
    /^bc1[a-z0-9]{39,59}$/i.test(addr) || // Bech32 / Bech32m
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr) // Legacy / P2SH
  );
}

export function btcToSats(btc: number): number {
  return Math.round(btc * 100_000_000);
}

export function satsToBtc(sats: number): number {
  return sats / 100_000_000;
}

// ============================================================
// Estado de la red Bitcoin (fee estimates)
// ============================================================

export interface BitcoinFees {
  fastest: number; // sat/vByte
  halfHour: number;
  hour: number;
  minimum: number;
}

export async function getBitcoinFees(): Promise<BitcoinFees> {
  const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
  if (!res.ok) throw new Error("Fee API error");
  return res.json();
}

// Obtener precio BTC en USD (vía mempool API)
export async function getBitcoinPrice(): Promise<{ price: number; updatedAt: number }> {
  const res = await fetch(`${MEMPOOL_API}/v1/prices`);
  if (!res.ok) throw new Error("Price API error");
  const data = await res.json();
  return {
    price: data.USD,
    updatedAt: Math.floor(Date.now() / 1000),
  };
}
