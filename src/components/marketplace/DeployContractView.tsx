"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Rocket,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  Copy,
  Code,
  Terminal,
  Shield,
} from "lucide-react";
import {
  connectWallet,
  CHAIN_IDS,
  NETWORK_PARAMS,
  switchNetwork,
} from "@/lib/web3";
import { CHAINS } from "@/lib/blockchain/config";

interface EscrowInfo {
  address: string;
  chain: string;
  deployer: string;
  txHash?: string;
  createdAt: string;
}

export default function DeployContractView() {
  const { user, escrowAddress, setEscrowAddress, setTab } = useApp();
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<EscrowInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState("");
  const [deployTx, setDeployTx] = useState("");
  const [manualAddress, setManualAddress] = useState("");

  useEffect(() => {
    fetchContract();
  }, []);

  async function fetchContract() {
    setLoading(true);
    try {
      const res = await fetch("/api/escrow-config");
      const data = await res.json();
      if (data.contract) {
        setInfo(data.contract);
        setEscrowAddress(data.contract.address);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeploy() {
    setError("");
    setDeploying(true);
    try {
      // 1. Conectar wallet
      const { address: deployer, chainId, signer } = await connectWallet();

      // 2. Validar red (solo Sepolia para MVP)
      if (chainId !== CHAIN_IDS.ETHEREUM_SEPOLIA) {
        await switchNetwork(NETWORK_PARAMS[CHAIN_IDS.ETHEREUM_SEPOLIA].chainId);
      }

      // 3. Verificar que tenga ETH para gas
      const balance = await signer.provider.getBalance(deployer);
      if (balance === 0n) {
        throw new Error(
          "Su wallet no tiene ETH de Sepolia. Obtenga ETH gratis en https://sepoliafaucet.com"
        );
      }

      // 4. Desplegar el contrato usando bytecode precompilado
      // NOTA: el bytecode se compila una vez y se pega en src/lib/web3.ts
      // Por ahora mostramos instrucciones de cómo obtenerlo
      throw new Error(
        "Para desplegar: compile el contrato con `npx hardhat compile` en smart-contracts/, " +
          "luego copie el bytecode de artifacts/P2PEscrow.sol/P2PEscrow.json " +
          "y péguelo en src/lib/web3.ts (variable ESCROW_BYTECODE). " +
          "Alternativamente, use la opción manual abajo."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeploying(false);
    }
  }

  async function saveManualAddress() {
    setError("");
    if (!manualAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
      setError("Dirección inválida. Debe ser 0x seguido de 40 caracteres hex.");
      return;
    }
    try {
      const res = await fetch("/api/escrow-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: manualAddress,
          chain: "ETHEREUM",
          deployer: user?.walletAddress || "manual",
          txHash: "",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setEscrowAddress(manualAddress);
      setInfo({
        address: manualAddress,
        chain: "ETHEREUM",
        deployer: user?.walletAddress || "manual",
        createdAt: new Date().toISOString(),
      });
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Rocket className="w-5 h-5 text-emerald-400" />
          Despliegue del contrato
        </h1>
        <p className="text-sm text-slate-400">
          El smart contract P2PEscrow debe desplegarse on-chain una sola vez.
          Una vez desplegado, todas las transacciones de escrow pasarán por él.
        </p>
      </div>

      {/* Estado actual */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          Contrato activo
        </h3>
        {loading ? (
          <div className="text-slate-400 text-sm">Cargando…</div>
        ) : info ? (
          <div className="space-y-3">
            <div className="p-3 rounded-md bg-slate-950 border border-emerald-700/50">
              <div className="text-[10px] text-slate-500 uppercase mb-1">
                Dirección (Sepolia)
              </div>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono text-emerald-400 break-all flex-1">
                  {info.address}
                </code>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-slate-500 hover:text-slate-200"
                  onClick={() => navigator.clipboard?.writeText(info.address)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
                <a
                  href={`https://sepolia.etherscan.io/address/${info.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 w-7 shrink-0 flex items-center justify-center text-slate-500 hover:text-emerald-400"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">Chain</div>
                <div className="text-slate-200">{info.chain}</div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">
                  Deployer
                </div>
                <div className="text-slate-200 font-mono text-[10px] truncate">
                  {info.deployer}
                </div>
              </div>
              <div className="p-2 rounded bg-slate-950 border border-slate-800">
                <div className="text-[10px] text-slate-500 uppercase">
                  Desplegado
                </div>
                <div className="text-slate-200 text-[10px]">
                  {new Date(info.createdAt).toLocaleDateString("es-CO")}
                </div>
              </div>
            </div>
            <Badge className="bg-emerald-950/50 border-emerald-700 text-emerald-400">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Activo
            </Badge>
          </div>
        ) : (
          <div className="text-center py-6">
            <AlertTriangle className="w-10 h-10 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-slate-300 font-medium">
              Ningún contrato desplegado todavía
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Sin contrato activo, los trades solo se registran en base de datos
              local (no on-chain).
            </p>
          </div>
        )}
      </Card>

      {/* Acciones */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3">
          Opciones de despliegue
        </h3>
        <div className="grid md:grid-cols-2 gap-3">
          <Button
            onClick={handleDeploy}
            disabled={deploying}
            className="bg-emerald-600 hover:bg-emerald-700 text-white h-auto py-3 flex flex-col items-center gap-1"
          >
            {deploying ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Rocket className="w-4 h-4" />
            )}
            <span className="text-xs">Desplegar con MetaMask</span>
          </Button>
          <Button
            onClick={() => setOpen(true)}
            variant="outline"
            className="border-slate-700 text-slate-300 hover:bg-slate-800 h-auto py-3 flex flex-col items-center gap-1"
          >
            <Code className="w-4 h-4" />
            <span className="text-xs">Pegar dirección manualmente</span>
          </Button>
        </div>
        {error && (
          <div className="mt-3 p-3 rounded-md bg-yellow-950/30 border border-yellow-900/50 text-xs text-yellow-300">
            {error}
          </div>
        )}
      </Card>

      {/* Instrucciones técnicas */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Compilar y obtener el bytecode (Hardhat)
        </h3>
        <div className="space-y-2">
          <Step n={1} title="Instalar Hardhat en el directorio smart-contracts/">
            <CodeBlock>
{`cd smart-contracts
npm init -y
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install @openzeppelin/contracts`}
            </CodeBlock>
          </Step>
          <Step n={2} title="Inicializar proyecto Hardhat">
            <CodeBlock>
{`npx hardhat init
# Elegir: "Create a JavaScript project"
# Aceptar defaults`}
            </CodeBlock>
          </Step>
          <Step n={3} title="Mover el contrato a contracts/">
            <CodeBlock>
{`# El archivo ya existe en:
# smart-contracts/P2PEscrow.sol
# Solo cree un symlink o cópielo a:
# smart-contracts/contracts/P2PEscrow.sol
mkdir -p contracts && cp P2PEscrow.sol contracts/`}
            </CodeBlock>
          </Step>
          <Step n={4} title="Compilar">
            <CodeBlock>
{`npx hardhat compile
# Output: Solidity compilation successful
# Genera: artifacts/P2PEscrow.sol/P2PEscrow.json`}
            </CodeBlock>
          </Step>
          <Step n={5} title="Copiar el bytecode al frontend">
            <CodeBlock>
{`# Extraer el bytecode del JSON:
cat artifacts/P2PEscrow.sol/P2PEscrow.json | jq -r '.bytecode'

# Pegar el resultado en:
# src/lib/web3.ts → variable ESCROW_BYTECODE
# (debe empezar con "0x" y ser un string largo)`}
            </CodeBlock>
          </Step>
          <Step n={6} title="Volver acá y desplegar con MetaMask">
            <p className="text-xs text-slate-400">
              Tras pegar el bytecode, haga clic en{" "}
              <strong className="text-emerald-400">Desplegar con MetaMask</strong>{" "}
              arriba. Se abrirá MetaMask pidiendo confirmación. El costo de gas
              en Sepolia es cero (es testnet).
            </p>
          </Step>
        </div>
      </Card>

      {/* Aviso */}
      <Card className="bg-amber-950/20 border-amber-900/40 p-5">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="text-xs text-amber-200/90 space-y-2">
            <p className="font-semibold">Antes de desplegar en mainnet</p>
            <p>
              El contrato <strong>no ha sido auditado</strong>. Antes de
              usarlo en mainnet con fondos reales, contrate una auditoría
              profesional (CertiK, OpenZeppelin, Trail of Bits). Para pruebas,
              use <strong>Sepolia testnet</strong> (ETH gratis en{" "}
              <a
                href="https://sepoliafaucet.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-300 hover:underline inline-flex items-center gap-1"
              >
                sepoliafaucet.com <ExternalLink className="w-2.5 h-2.5" />
              </a>
              ).
            </p>
          </div>
        </div>
      </Card>

      {/* Modal pegar dirección manual */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-emerald-400">
              Pegar dirección del contrato
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Si ya desplegó el contrato manualmente con Hardhat, pegue acá la
              dirección devuelta.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-slate-300 mb-1.5 block">
                Dirección del contrato (0x…)
              </Label>
              <Input
                value={manualAddress}
                onChange={(e) => setManualAddress(e.target.value)}
                placeholder="0xABC123..."
                className="bg-slate-950 border-slate-700 text-slate-100 font-mono text-sm"
              />
            </div>
            {error && (
              <div className="text-xs text-red-400">{error}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              onClick={saveManualAddress}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Guardar dirección
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
        {n}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 mb-1">{title}</div>
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="bg-slate-950 border border-slate-800 rounded-md p-3 overflow-x-auto text-[11px] font-mono text-emerald-300 leading-relaxed">
      {children}
    </pre>
  );
}
