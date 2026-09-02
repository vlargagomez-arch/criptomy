"use client";

import { useState, useEffect, useCallback } from "react";
import { useApp } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import { Image as ImageIcon, Plus, Loader2, ExternalLink, X } from "lucide-react";

interface NFTListing {
  id: string;
  chain: string;
  contractAddress: string;
  tokenId: string;
  name: string;
  description: string | null;
  imageCID: string | null;
  imageGateway: string | null;
  priceAmount: number;
  priceCurrency: string;
  status: string;
  createdAt: string;
  seller: { alias: string; walletAddress: string };
}

const CHAINS = [
  { id: "all", name: "Todas", color: "bg-slate-700" },
  { id: "polygon", name: "Polygon", color: "bg-purple-600" },
  { id: "base", name: "Base", color: "bg-blue-600" },
  { id: "ethereum", name: "Ethereum", color: "bg-slate-500" },
];

export default function NFTMarketplaceView() {
  const { user } = useApp();
  const [listings, setListings] = useState<NFTListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [chainFilter, setChainFilter] = useState("all");
  const [showMintDialog, setShowMintDialog] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nft?chain=${chainFilter}&status=LISTED`);
      if (!res.ok) return;
      const data = await res.json();
      setListings(data.listings || []);
    } finally {
      setLoading(false);
    }
  }, [chainFilter]);

  useEffect(() => {
    load();
  }, [load]);

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center text-slate-400">
        Conecta tu wallet para ver el marketplace NFT.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-emerald-400" />
            Mercado NFT
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Compra, vende y mintea NFTs en Polygon, Base y Ethereum. Sin KYC.
          </p>
        </div>
        <Button
          onClick={() => setShowMintDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Mintear + Listar NFT
        </Button>
      </div>

      {/* Filtros chain */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {CHAINS.map((c) => (
          <button
            key={c.id}
            onClick={() => setChainFilter(c.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
              chainFilter === c.id
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Grid NFT */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No hay NFTs listados todavía.</p>
          <p className="text-xs mt-1">¡Sé el primero en mintear uno!</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {listings.map((nft) => (
            <NFTCard key={nft.id} nft={nft} onBuy={load} currentAddress={user.walletAddress} />
          ))}
        </div>
      )}

      {/* Mint Dialog */}
      <MintDialog
        open={showMintDialog}
        onOpenChange={setShowMintDialog}
        user={user}
        onMinted={() => {
          setShowMintDialog(false);
          load();
        }}
      />
    </div>
  );
}

function NFTCard({ nft, onBuy, currentAddress }: {
  nft: NFTListing;
  onBuy: () => void;
  currentAddress: string;
}) {
  const [buying, setBuying] = useState(false);
  const [showBuy, setShowBuy] = useState(false);

  const isOwn = nft.seller.walletAddress.toLowerCase() === currentAddress.toLowerCase();

  const buy = async () => {
    setBuying(true);
    try {
      // Marca como comprado en backend. La transferencia real del pago
      // se hace off-chain (vía MetaMask el buyer envía USDT/ETH directo al seller).
      // Aquí solo registramos el sale.
      const res = await fetch("/api/nft?op=buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: nft.id,
          buyerAddress: currentAddress,
          saleTxHash: "manual", // idealmente capturar tx hash real
        }),
      });
      if (res.ok) {
        setShowBuy(false);
        onBuy();
      }
    } finally {
      setBuying(false);
    }
  };

  const delist = async () => {
    if (!confirm("¿Delistar este NFT?")) return;
    try {
      await fetch("/api/nft?op=delist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId: nft.id, address: currentAddress }),
      });
      onBuy();
    } catch (e) {
      // ignore
    }
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden hover:border-emerald-600/50 transition group">
      {/* Imagen */}
      <div className="aspect-square bg-slate-800 relative">
        {nft.imageGateway ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nft.imageGateway}
            alt={nft.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-700">
            <ImageIcon className="w-12 h-12" />
          </div>
        )}
        <div className="absolute top-2 left-2 px-2 py-1 text-[10px] font-bold rounded bg-black/60 backdrop-blur text-white uppercase">
          {nft.chain}
        </div>
      </div>

      {/* Datos */}
      <div className="p-3">
        <div className="text-sm font-semibold text-slate-100 truncate">{nft.name}</div>
        {nft.description && (
          <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
            {nft.description}
          </div>
        )}
        <div className="flex items-center justify-between mt-2">
          <div>
            <div className="text-[10px] text-slate-500">Precio</div>
            <div className="text-sm font-bold text-emerald-400">
              {nft.priceAmount} {nft.priceCurrency}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500">Vendedor</div>
            <div className="text-[11px] text-slate-300">@{nft.seller.alias}</div>
          </div>
        </div>

        {isOwn ? (
          <button
            onClick={delist}
            className="w-full mt-3 px-3 py-1.5 text-[11px] rounded bg-slate-800 hover:bg-red-900 text-slate-300 hover:text-red-300 transition"
          >
            Delistar
          </button>
        ) : (
          <Button
            onClick={() => setShowBuy(true)}
            className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
          >
            Comprar
          </Button>
        )}
      </div>

      {/* Modal de compra */}
      {showBuy && (
        <Dialog open={showBuy} onOpenChange={setShowBuy}>
          <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-md">
            <DialogHeader>
              <DialogTitle>Comprar NFT: {nft.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p className="text-slate-300">
                Para completar la compra:
              </p>
              <ol className="space-y-2 text-xs text-slate-400 list-decimal pl-4">
                <li>
                  Envía <b className="text-emerald-400">{nft.priceAmount} {nft.priceCurrency}</b> desde tu wallet a la dirección del vendedor:
                </li>
                <li className="font-mono text-[11px] bg-slate-800 p-2 rounded break-all">
                  {nft.seller.walletAddress}
                </li>
                <li>
                  Pídele al vendedor que transfiera el NFT (tokenId <b>#{nft.tokenId}</b>) a tu wallet usando OpenSea o el marketplace nativo.
                </li>
                <li>
                  Cuando se complete, presiona <b>Confirmar compra</b> para marcarla como vendida en nuestra plataforma.
                </li>
              </ol>
            </div>
            <DialogFooter>
              <DialogClose className="text-slate-400 hover:text-slate-100 text-sm">Cancelar</DialogClose>
              <Button
                onClick={buy}
                disabled={buying}
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {buying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmar compra"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MintDialog({ open, onOpenChange, user, onMinted }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: { walletAddress: string };
  onMinted: () => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [chain, setChain] = useState("polygon");
  const [contractAddress, setContractAddress] = useState("");
  const [tokenId, setTokenId] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USDT");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCID, setImageCID] = useState<string | null>(null);
  const [imageGateway, setImageGateway] = useState<string | null>(null);

  const reset = () => {
    setStep(1);
    setName("");
    setDescription("");
    setChain("polygon");
    setContractAddress("");
    setTokenId("");
    setPriceAmount("");
    setPriceCurrency("USDT");
    setImageFile(null);
    setImagePreview(null);
    setImageCID(null);
    setImageGateway(null);
    setError(null);
  };

  const handleFile = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setImageCID(null);
    setImageGateway(null);
  };

  const uploadImage = async () => {
    if (!imageFile) return false;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", imageFile);
      const res = await fetch("/api/ipfs?op=upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!data.cid) {
        setError("Error subiendo imagen a IPFS");
        return false;
      }
      setImageCID(data.cid);
      setImageGateway(data.url);
      if (!data.pinned) {
        console.warn("[nft-mint] IPFS no persistente, configurar Pinata para CID público");
      }
      return true;
    } catch (e) {
      setError("Error subiendo: " + (e as Error).message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    if (!name || !contractAddress || !tokenId || !priceAmount) {
      setError("Faltan campos obligatorios");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      // Si hay imagen pero no subida, subirla primero
      if (imageFile && !imageCID) {
        const ok = await uploadImage();
        if (!ok) {
          setCreating(false);
          return;
        }
      }

      const res = await fetch("/api/nft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: user.walletAddress,
          chain,
          contractAddress,
          tokenId,
          name,
          description,
          imageCID,
          imageGateway,
          priceAmount: parseFloat(priceAmount),
          priceCurrency,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error creando listing");
        return;
      }
      reset();
      onMinted();
    } catch (e) {
      setError("Error: " + (e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Mintear y listar NFT</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Info importante */}
          <div className="bg-amber-950/30 border border-amber-800/50 rounded-lg p-3 text-[11px] text-amber-300">
            <b>¿Cómo funciona?</b>
            <ol className="mt-1 list-decimal pl-4 space-y-0.5">
              <li>Mintea tu NFT en la blockchain (con OpenSea, Manifold, o tu propio contrato ERC-721).</li>
              <li>Sube aquí la imagen + metadata + el contractAddress + tokenId de tu NFT.</li>
              <li>Listalo con tu precio. Cuando alguien compre, recibe el pago directo a tu wallet.</li>
            </ol>
          </div>

          {/* Imagen */}
          <div>
            <Label className="text-xs">Imagen del NFT *</Label>
            <div className="mt-2 flex items-center gap-3">
              <div className="w-20 h-20 bg-slate-800 rounded-lg overflow-hidden flex items-center justify-center">
                {imagePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon className="w-8 h-8 text-slate-600" />
                )}
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
                className="hidden"
                id="nft-image-upload"
              />
              <label
                htmlFor="nft-image-upload"
                className="cursor-pointer px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
              >
                {imageFile ? "Cambiar" : "Subir imagen"}
              </label>
              {imageFile && (
                <button
                  onClick={() => {
                    setImageFile(null);
                    setImagePreview(null);
                  }}
                  className="text-slate-500 hover:text-red-400"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            {imageCID && (
              <div className="mt-1 text-[10px] text-emerald-400 flex items-center gap-1">
                IPFS CID: {imageCID.slice(0, 20)}...
                {imageGateway && (
                  <a href={imageGateway} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-slate-100">
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Nombre */}
          <div>
            <Label className="text-xs">Nombre del NFT *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mi NFT #1"
              className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
            />
          </div>

          {/* Descripción */}
          <div>
            <Label className="text-xs">Descripción (opcional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción corta..."
              className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
              rows={2}
            />
          </div>

          {/* Chain */}
          <div>
            <Label className="text-xs">Blockchain *</Label>
            <select
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
            >
              <option value="polygon">Polygon</option>
              <option value="base">Base</option>
              <option value="ethereum">Ethereum</option>
            </select>
          </div>

          {/* Contract address + tokenId */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Contract address *</Label>
              <Input
                value={contractAddress}
                onChange={(e) => setContractAddress(e.target.value)}
                placeholder="0x..."
                className="mt-1 bg-slate-800 border-slate-700 text-slate-100 text-xs font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Token ID *</Label>
              <Input
                value={tokenId}
                onChange={(e) => setTokenId(e.target.value)}
                placeholder="1"
                className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
          </div>

          {/* Precio */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Precio *</Label>
              <Input
                type="number"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                placeholder="0.05"
                step="any"
                className="mt-1 bg-slate-800 border-slate-700 text-slate-100"
              />
            </div>
            <div>
              <Label className="text-xs">Moneda *</Label>
              <select
                value={priceCurrency}
                onChange={(e) => setPriceCurrency(e.target.value)}
                className="mt-1 w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-slate-100 text-sm"
              >
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
                <option value="ETH">ETH</option>
                <option value="MATIC">MATIC</option>
              </select>
            </div>
          </div>

          {error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800/50 rounded p-2">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose className="text-slate-400 hover:text-slate-100 text-sm">Cancelar</DialogClose>
          <Button
            onClick={submit}
            disabled={creating || uploading}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            {creating || uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {uploading ? "Subiendo imagen..." : creating ? "Listando..." : "Listar NFT"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
