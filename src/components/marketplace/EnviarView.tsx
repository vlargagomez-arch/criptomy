"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Send, Loader2, AlertTriangle, CheckCircle2, ExternalLink, Info, ShieldCheck, Wallet } from "lucide-react";

const NETWORKS = [
  { id: "ETHEREUM", chainIdHex: "0x1", name: "Ethereum", symbol: "ETH", explorer: "https://etherscan.io/tx/" },
  { id: "POLYGON", chainIdHex: "0x89", name: "Polygon", symbol: "MATIC", explorer: "https://polygonscan.com/tx/" },
  { id: "BSC", chainIdHex: "0x38", name: "BNB Chain", symbol: "BNB", explorer: "https://bscscan.com/tx/" },
  { id: "BASE", chainIdHex: "0x2105", name: "Base", symbol: "ETH", explorer: "https://basescan.org/tx/" },
  { id: "ARBITRUM", chainIdHex: "0xa4b1", name: "Arbitrum", symbol: "ETH", explorer: "https://arbiscan.io/tx/" },
];

// Direcciones de contratos USDT y USDC por red (para ERC-20 transfer)
const TOKENS: Record<string, { symbol: string; address: Record<string, string | null>; decimals: number }[]> = {
  ETHEREUM: [
    { symbol: "USDT", address: { ETHEREUM: "0xdAC17F958D2ee523a2206206994597C52D944a47" }, decimals: 6 },
    { symbol: "USDC", address: { ETHEREUM: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" }, decimals: 6 },
  ],
  POLYGON: [
    { symbol: "USDT", address: { POLYGON: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" }, decimals: 6 },
    { symbol: "USDC", address: { POLYGON: "0x3c499c542cEF5E3811e1192ce70d8cc03d5c3359" }, decimals: 6 },
  ],
  BSC: [
    { symbol: "USDT", address: { BSC: "0x55d398326f99059fF775485246999027B3197955" }, decimals: 18 },
    { symbol: "USDC", address: { BSC: "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d" }, decimals: 18 },
  ],
  BASE: [
    { symbol: "USDC", address: { BASE: "0x833589fCD6eDb6Ee088c21f1cd6a55D2b27E0c4E" }, decimals: 6 },
  ],
  ARBITRUM: [
    { symbol: "USDT", address: { ARBITRUM: "0xFd086bD7b31F67FBeA3a21c7eb8B5cA1eA6aFAF0" }, decimals: 6 },
    { symbol: "USDC", address: { ARBITRUM: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" }, decimals: 6 },
  ],
};

export default function EnviarView() {
  const { user } = useApp();
  const [networkId, setNetworkId] = useState("POLYGON");
  const [token, setToken] = useState("NATIVE");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsNetworkSwitch, setNeedsNetworkSwitch] = useState(false);

  const network = NETWORKS.find((n) => n.id === networkId)!;
  const tokens = TOKENS[networkId] || [];

  useEffect(() => {
    // Reset token si cambió la red
    setToken("NATIVE");
  }, [networkId]);

  const send = async () => {
    setError(null);
    setTxHash(null);
    if (!user) {
      setError("Conecta tu wallet primero");
      return;
    }
    if (!toAddress || !amount) {
      setError("Indica dirección destino y cantidad");
      return;
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      setError("Dirección destino inválida");
      return;
    }

    setSending(true);
    try {
      // 1) Verificar/cambiar red
      const eth = (window as { ethereum?: { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> } }).ethereum;
      if (!eth) {
        setError("MetaMask no está instalado");
        return;
      }

      const currentChainHex = (await eth.request({ method: "eth_chainId" })) as string;
      if (currentChainHex.toLowerCase() !== network.chainIdHex.toLowerCase()) {
        try {
          await eth.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: network.chainIdHex }],
          });
        } catch (e) {
          setError(`Cambia a la red ${network.name} en tu MetaMask. (Error: ${(e as Error).message})`);
          setNeedsNetworkSwitch(true);
          setSending(false);
          return;
        }
      }

      // 2) Construir transacción
      const from = user.walletAddress;
      const valueWei = token === "NATIVE" ? bigintAmount(amount, 18).toString(16) : "0x0";

      if (token === "NATIVE") {
        // Native ETH/MATIC/BNB transfer
        const params = [
          {
            from,
            to: toAddress,
            value: "0x" + valueWei,
          },
        ];
        const hash = (await eth.request({
          method: "eth_sendTransaction",
          params,
        })) as string;
        setTxHash(hash);
      } else {
        // ERC-20 transfer
        const tokenInfo = tokens.find((t) => t.symbol === token);
        if (!tokenInfo || !tokenInfo.address[networkId]) {
          setError(`Token ${token} no soportado en ${network.name}`);
          setSending(false);
          return;
        }
        const contractAddr = tokenInfo.address[networkId]!;
        const tokenAmount = bigintAmount(amount, tokenInfo.decimals).toString(16);

        // transfer(address,uint256) selector = 0xa9059cbb
        const data =
          "0xa9059cbb" +
          toAddress.slice(2).padStart(64, "0") +
          tokenAmount.padStart(64, "0");

        const params = [
          {
            from,
            to: contractAddr,
            data,
          },
        ];
        const hash = (await eth.request({
          method: "eth_sendTransaction",
          params,
        })) as string;
        setTxHash(hash);
      }
    } catch (e) {
      setError((e as Error).message || "Error al enviar");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-6">
      {!user && null}

      {/* Panel explicativo */}
      <div className="mb-6 bg-slate-900/50 border border-slate-800/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-semibold text-slate-200 uppercase tracking-wide">¿Cómo funciona?</h3>
        </div>
        <ol className="text-[12px] text-slate-400 space-y-1.5 list-decimal pl-4">
          <li>Selecciona red (Ethereum, Polygon, BNB Chain, Base, Arbitrum) y token.</li>
          <li>Pega la dirección destino (verifica que sea compatible con la red elegida).</li>
          <li>Escribe la cantidad.</li>
          <li>
            <b className="text-slate-200">Click en "Enviar"</b> — se abre tu MetaMask pidiendo
            firmar la transacción. Tú confirmas, nosotros no firmamos por ti.
          </li>
          <li>
            <b className="text-slate-200">MetaMask envía la transacción on-chain</b>. Te
            mostramos el hash y un link al explorer para ver el estado.
          </li>
        </ol>
        <div className="mt-3 pt-3 border-t border-slate-800/50 flex items-center gap-2 text-[10px] text-slate-400">
          <ShieldCheck className="w-3 h-3 text-emerald-400" />
          100% non-custodial. La transacción va directa de tu wallet a la dirección destino.
          Nosotros nunca tocamos tus fondos ni tus claves privadas.
        </div>
      </div>

      {!user && null}

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">Red</label>
            <select
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              {NETWORKS.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-400">Token</label>
            <select
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="mt-1 w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              <option value="NATIVE">{network.symbol} (nativo)</option>
              {tokens.map((t) => (
                <option key={t.symbol} value={t.symbol}>
                  {t.symbol}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Dirección destino</label>
          <input
            type="text"
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            placeholder="0x..."
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm font-mono"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400">Cantidad ({token === "NATIVE" ? network.symbol : token})</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="any"
            className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
          />
        </div>

        <div className="bg-amber-950/30 border border-amber-800/50 rounded p-2 text-[11px] text-amber-300 flex gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            Verifica que la dirección destino sea compatible con <b>{network.name}</b>. Enviar a
            una red incorrecta puede resultar en pérdida permanente de los fondos.
          </span>
        </div>

        <button
          onClick={send}
          disabled={!user || sending || !toAddress || !amount}
          className="w-full bg-cyan-600 hover:bg-cyan-500 text-white py-2 rounded text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {sending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Abriendo MetaMask...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" /> Enviar {amount || 0} {token === "NATIVE" ? network.symbol : token}
            </>
          )}
        </button>

        {error && (
          <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded p-2">
            {error}
          </div>
        )}

        {txHash && (
          <div className="text-xs p-3 bg-emerald-950/30 border border-emerald-800/50 rounded flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-emerald-300 font-medium">Transacción enviada</p>
              <p className="text-slate-400 mt-1 font-mono break-all text-[11px]">{txHash}</p>
              <a
                href={`${network.explorer}${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 mt-1"
              >
                Ver en explorer <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Convertir cantidad decimal a BigInt con N decimales
function bigintAmount(amountStr: string, decimals: number): bigint {
  const [intPart, decPart = ""] = amountStr.split(".");
  const paddedDec = (decPart + "0".repeat(decimals)).slice(0, decimals);
  const combined = intPart + paddedDec;
  try {
    return BigInt(combined || "0");
  } catch {
    return 0n;
  }
}
