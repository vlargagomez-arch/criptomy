"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Gamepad2,
  Plus,
  Link2,
  Loader2,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Swords,
  AlertCircle,
} from "lucide-react";
import {
  GameType,
  getAllGames,
  getGameAdapter,
  getGameImageURL,
  formatStake,
  totalPot,
  winnerPayout,
  challengeStatusLabels,
} from "@/lib/games";
import { avatarGradient, timeAgo } from "@/lib/format";

interface GameAccount {
  id: string;
  game: GameType;
  accountRegion: string;
  accountId: string;
  accountName: string;
  verifiedAt: string;
}

interface ChallengePlayer {
  id: string;
  alias: string;
  avatarSeed: string | null;
  reputationScore: number;
  walletAddress?: string;
}

interface Challenge {
  id: string;
  game: GameType;
  mode: string;
  stakeAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  creator: ChallengePlayer;
  opponent: ChallengePlayer | null;
  winner: { id: string; alias: string; walletAddress?: string } | null;
  payoutStatus?: string;
  payoutTxHash?: string | null;
  payoutAmount?: number | null;
  payoutError?: string | null;
  escrowTxHash?: string | null;
  resultDeadline?: string | null;
  reportedWinner?: string | null;
  resultScreenshot?: string | null;
}

export default function RetosP2PView() {
  const { user } = useApp();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [accounts, setAccounts] = useState<GameAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"open" | "mine">("open");
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      const [chRes, accRes] = await Promise.all([
        fetch(
          `/api/challenges?${activeTab === "mine" && user ? `userId=${user.id}` : "status=OPEN"}`
        ),
        user ? fetch(`/api/games/link?userId=${user.id}`) : Promise.resolve({ json: async () => ({ accounts: [] }) } as Response),
      ]);
      const chData = await chRes.json();
      const accData = await accRes.json();
      setChallenges(chData.challenges || []);
      setAccounts(accData.accounts || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Retos P2P
          </h1>
          <p className="text-sm text-slate-400">
            Apuesta cripto en partidos 1v1 · verificación automática vía API del juego
          </p>
        </div>
        {user && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLinkOpen(true)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              <Link2 className="w-4 h-4 mr-2" />
              Vincular cuenta
              {accounts.length > 0 && (
                <Badge className="ml-2 bg-emerald-950/50 text-emerald-400 text-[10px]">
                  {accounts.length}
                </Badge>
              )}
            </Button>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={accounts.length === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Crear reto
            </Button>
          </div>
        )}
      </div>

      {/* Juegos soportados */}
      <div className="flex flex-wrap gap-2">
        {getAllGames().map((g) => (
          <Badge
            key={g.type}
            variant="outline"
            className="bg-slate-900 border-slate-800 text-slate-400 py-1.5 px-2"
          >
            <img
              src={getGameImageURL(g.type)}
              alt={g.name}
              className="w-5 h-5 rounded mr-1.5 inline-block"
            />
            {g.shortName}
          </Badge>
        ))}
      </div>

      {/* Stats rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Retos abiertos" value={challenges.filter(c => c.status === "OPEN").length} icon={Clock} color="text-emerald-400" />
        <StatCard label="En progreso" value={challenges.filter(c => c.status === "IN_PROGRESS").length} icon={Swords} color="text-yellow-400" />
        <StatCard label="Completados" value={challenges.filter(c => c.status === "COMPLETED").length} icon={CheckCircle2} color="text-cyan-400" />
        <StatCard label="Depósitos reales" value={`${challenges.filter(c => c.escrowTxHash).reduce((s, c) => s + c.stakeAmount * 2, 0).toFixed(0)} USDT`} icon={Zap} color="text-purple-400" />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="open" onValueChange={(v) => setActiveTab(v as "open" | "mine")}>
        <TabsList className="bg-slate-900 border border-slate-800">
          <TabsTrigger value="open" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Retos abiertos
          </TabsTrigger>
          <TabsTrigger value="mine" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
            Mis retos
          </TabsTrigger>
        </TabsList>
      </Tabs>
        <div className="mt-4">
          {!user ? (
            <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
              <Gamepad2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">Conecte su wallet para empezar</p>
              <p className="text-sm text-slate-500 mt-1">
                Necesita una wallet para crear y aceptar retos
              </p>
            </Card>
          ) : loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-24 w-full bg-slate-900" />
              ))}
            </div>
          ) : challenges.length === 0 ? (
            <Card className="bg-slate-900/40 border-slate-800 p-12 text-center">
              <Trophy className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-300 font-medium">
                {activeTab === "open" ? "No hay retos abiertos" : "No tienes retos aún"}
              </p>
              <p className="text-sm text-slate-500 mt-1">
                {activeTab === "open" ? "Sé el primero en crear un reto" : "Crea tu primer reto o acepta uno abierto"}
              </p>
              {accounts.length === 0 ? (
                <Button
                  onClick={() => setLinkOpen(true)}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Vincular cuenta de juego
                </Button>
              ) : (
                <Button
                  onClick={() => setCreateOpen(true)}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Crear reto
                </Button>
              )}
            </Card>
          ) : (
            <div className="space-y-2">
              {challenges.map((c) => (
                <ChallengeRow
                  key={c.id}
                  challenge={c}
                  currentUserId={user.id}
                  userAccounts={accounts}
                  onClick={() => setSelectedChallenge(c)}
                />
              ))}
            </div>
          )}
        </div>

      {/* Cómo funciona */}
      <Card className="bg-slate-900/60 border-slate-800 p-5">
        <h3 className="text-sm font-semibold text-slate-100 mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-emerald-400" />
          Cómo funciona
        </h3>
        <div className="grid md:grid-cols-5 gap-3 text-xs">
          {[
            { n: 1, t: "Vincular cuenta", d: "Conecta tu cuenta de LoL, Valorant o CS2" },
            { n: 2, t: "Crear/aceptar reto", d: "Apuesta USDT contra otro jugador" },
            { n: 3, t: "Escrow", d: "Ambos depositan en smart contract" },
            { n: 4, t: "Jugar", d: "Disputan el partido en el juego" },
            { n: 5, t: "Auto-pago", d: "La API verifica el ganador y libera fondos" },
          ].map((s) => (
            <div key={s.n} className="p-3 rounded-md bg-slate-950 border border-slate-800">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center mb-2">
                {s.n}
              </div>
              <div className="text-slate-200 font-medium mb-1">{s.t}</div>
              <p className="text-slate-500 leading-relaxed">{s.d}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Modals */}
      {createOpen && (
        <CreateChallengeModal
          userId={user!.id}
          accounts={accounts}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            setActiveTab("mine");
            fetchData();
          }}
        />
      )}

      {linkOpen && (
        <LinkGameAccountModal
          userId={user!.id}
          onClose={() => setLinkOpen(false)}
          onLinked={() => {
            setLinkOpen(false);
            fetchData();
          }}
        />
      )}

      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          currentUserId={user!.id}
          userAccounts={accounts}
          onClose={() => setSelectedChallenge(null)}
          onUpdate={() => {
            setSelectedChallenge(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <Card className="bg-slate-900/60 border-slate-800 p-3">
      <Icon className={`w-4 h-4 ${color} mb-1`} />
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-400">{label}</div>
    </Card>
  );
}

function ChallengeRow({
  challenge,
  currentUserId,
  userAccounts,
  onClick,
}: {
  challenge: Challenge;
  currentUserId: string;
  userAccounts: GameAccount[];
  onClick: () => void;
}) {
  const adapter = getGameAdapter(challenge.game);
  const status = challengeStatusLabels(challenge.status);
  const isCreator = challenge.creator.id === currentUserId;
  const isOpponent = challenge.opponent?.id === currentUserId;
  const canAccept =
    challenge.status === "OPEN" &&
    !isCreator &&
    userAccounts.some((a) => a.game === challenge.game);

  return (
    <Card
      onClick={onClick}
      className="bg-slate-900/60 border-slate-800 p-4 hover:border-emerald-700/40 transition cursor-pointer"
    >
      <div className="grid grid-cols-12 gap-3 items-center">
        {/* Juego + modo */}
        <div className="col-span-12 sm:col-span-3">
          <div className="flex items-center gap-2">
            <img src={getGameImageURL(challenge.game)} alt={adapter.name} className="w-8 h-8 rounded-lg" />
            <div>
              <div className="text-sm font-semibold text-slate-100">{adapter.shortName}</div>
              <div className="text-[10px] text-slate-500">{challenge.mode}</div>
            </div>
          </div>
        </div>

        {/* Jugadores */}
        <div className="col-span-12 sm:col-span-5">
          <div className="flex items-center gap-2">
            <PlayerChip player={challenge.creator} isYou={isCreator} />
            <span className="text-xs text-slate-500 font-bold">VS</span>
            <PlayerChip
              player={challenge.opponent}
              isYou={isOpponent}
              isWinner={challenge.winner?.id === challenge.opponent?.id}
            />
          </div>
        </div>

        {/* Apuesta — honesto sobre qué es real */}
        <div className="col-span-6 sm:col-span-2">
          <div className="text-[10px] text-slate-500 uppercase">
            {challenge.escrowTxHash ? "Pool depositado" : "Apuesta (sin depositar)"}
          </div>
          <div className={`text-sm font-mono ${
            challenge.escrowTxHash ? "text-emerald-400" : "text-slate-500"
          }`}>
            {challenge.escrowTxHash
              ? formatStake(totalPot(challenge.stakeAmount))
              : `${challenge.stakeAmount} USDT`
            }
          </div>
        </div>

        {/* Estado + acción */}
        <div className="col-span-6 sm:col-span-2 flex flex-col items-end gap-1">
          <Badge variant="outline" className={`text-[10px] ${status.color}`}>
            {status.label}
          </Badge>
          {canAccept && (
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white">
              Aceptar
            </Button>
          )}
          {challenge.status === "COMPLETED" && challenge.winner && (
            <div className="text-[10px] text-emerald-400 flex items-center gap-1">
              <Trophy className="w-2.5 h-2.5" />
              {challenge.winner.alias}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function PlayerChip({
  player,
  isYou,
  isWinner,
}: {
  player: ChallengePlayer | null;
  isYou?: boolean;
  isWinner?: boolean;
}) {
  if (!player) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="w-6 h-6 rounded-full bg-slate-800 border border-dashed border-slate-700" />
        <span className="text-xs text-slate-600">Esperando…</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Avatar className={`w-6 h-6 bg-gradient-to-br ${avatarGradient(player.avatarSeed)}`}>
        <AvatarFallback className="bg-transparent text-white text-[9px]">
          {player.alias.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div>
        <div className="text-xs text-slate-200 flex items-center gap-1">
          {player.alias}
          {isYou && <span className="text-emerald-400 text-[9px]">(tú)</span>}
          {isWinner && <Trophy className="w-2.5 h-2.5 text-yellow-400" />}
        </div>
        <div className="text-[9px] text-slate-500">★ {player.reputationScore.toFixed(0)}</div>
      </div>
    </div>
  );
}

// ============================================================
// Modal: Crear reto
// ============================================================
function CreateChallengeModal({
  userId,
  accounts,
  onClose,
  onCreated,
}: {
  userId: string;
  accounts: GameAccount[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [game, setGame] = useState<GameType>(accounts[0]?.game || "LEAGUE_OF_LEGENDS");
  const [mode, setMode] = useState("");
  const [stake, setStake] = useState("10");
  const [accountId, setAccountId] = useState(accounts[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const adapter = getGameAdapter(game);
  const availableAccounts = accounts.filter((a) => a.game === game);

  useEffect(() => {
    const acc = accounts.find((a) => a.game === game);
    if (acc) setAccountId(acc.id);
  }, [game, accounts]);

  async function handleCreate() {
    setError("");
    if (!mode || !stake || !accountId) {
      setError("Complete todos los campos");
      return;
    }
    if (parseFloat(stake) < 1) {
      setError("Apuesta mínima: 1 USDT");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/challenges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: userId,
          game,
          mode,
          stakeAmount: parseFloat(stake),
          creatorGameAccountId: accountId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Crear reto
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Apuesta USDT contra otro jugador. El ganador se lleva el 95% del pool.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-slate-300 mb-1.5 block">Juego</Label>
            <Select value={game} onValueChange={(v) => setGame(v as GameType)}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {getAllGames().map((g) => (
                  <SelectItem key={g.type} value={g.type}>
                    <img src={getGameImageURL(g.type)} alt="" className="w-4 h-4 rounded inline mr-2" /> {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">Modo de juego</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue placeholder="Seleccione modo" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {adapter.modes.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name} — {m.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">Tu cuenta de {adapter.shortName}</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {availableAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.accountName} ({a.accountRegion})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {availableAccounts.length === 0 && (
              <p className="text-[10px] text-yellow-400 mt-1">
                No tienes cuenta de {adapter.shortName} vinculada
              </p>
            )}
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">
              Apuesta por jugador (USDT) · Min $1 · Max $100
            </Label>
            <Input
              type="number"
              value={stake}
              onChange={(e) => setStake(e.target.value)}
              min="1"
              max="100"
              step="1"
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono"
            />
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>Pool si ambos depositan: {formatStake(totalPot(Math.min(parseFloat(stake) || 0, 100)))}</span>
              <span>Ganador recibe (est.): {winnerPayout(parseFloat(stake) || 0).toFixed(2)} USDT</span>
            </div>
          </div>

          {error && (
            <div className="p-2 rounded-md bg-red-950/50 border border-red-900/50 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Crear reto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal: Vincular cuenta de juego
// ============================================================
function LinkGameAccountModal({
  userId,
  onClose,
  onLinked,
}: {
  userId: string;
  onClose: () => void;
  onLinked: () => void;
}) {
  const [game, setGame] = useState<GameType>("LEAGUE_OF_LEGENDS");
  const [region, setRegion] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountId, setAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const adapter = getGameAdapter(game);

  async function handleLink() {
    setError("");
    if (!region || !accountName || !accountId) {
      setError("Complete todos los campos");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/games/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          game,
          accountRegion: region,
          accountId,
          accountName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onLinked();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Vincular cuenta de juego
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Necesario para crear y aceptar retos. Verificamos propiedad antes de cada match.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <Label className="text-slate-300 mb-1.5 block">Juego</Label>
            <Select value={game} onValueChange={(v) => { setGame(v as GameType); setRegion(""); }}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {getAllGames().map((g) => (
                  <SelectItem key={g.type} value={g.type}>
                    <img src={getGameImageURL(g.type)} alt="" className="w-4 h-4 rounded inline mr-2" /> {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">{adapter.accountRegionLabel}</Label>
            <Select value={region} onValueChange={setRegion}>
              <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
                <SelectValue placeholder="Seleccione región" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
                {adapter.regions.map((r) => (
                  <SelectItem key={r.code} value={r.code}>
                    {r.name} ({r.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">{adapter.accountInputLabel}</Label>
            <Input
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              placeholder={adapter.accountNamePlaceholder}
              className="bg-slate-950 border-slate-700 text-slate-100"
            />
          </div>

          <div>
            <Label className="text-slate-300 mb-1.5 block">ID interno (PUUID / Steam ID)</Label>
            <Input
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              placeholder="ej: 1234567890"
              className="bg-slate-950 border-slate-700 text-slate-100 font-mono text-xs"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              Lo usamos para verificar los resultados de los partidos vía API oficial
            </p>
          </div>

          {error && (
            <div className="p-2 rounded-md bg-red-950/50 border border-red-900/50 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleLink}
            disabled={loading}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Vincular cuenta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Modal: Detalle de reto + acciones
// ============================================================
function ChallengeDetailModal({
  challenge,
  currentUserId,
  userAccounts,
  onClose,
  onUpdate,
}: {
  challenge: Challenge;
  currentUserId: string;
  userAccounts: GameAccount[];
  onClose: () => void;
  onUpdate: () => void;
}) {
  const adapter = getGameAdapter(challenge.game);
  const status = challengeStatusLabels(challenge.status);
  const isCreator = challenge.creator.id === currentUserId;
  const isOpponent = challenge.opponent?.id === currentUserId;
  const [actionLoading, setActionLoading] = useState(false);
  const [matchId, setMatchId] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function doAction(action: string, extra: Record<string, unknown> = {}) {
    setActionLoading(true);
    setError("");

    try {
      // ============================================================
      // DEPÓSITO REAL DE USDT VIA METAMASK
      // ============================================================
      if (action === "fund") {
        setResult("Conectando MetaMask…");
        const { connectWallet } = await import("@/lib/web3");
        const { signer, address, chainId } = await connectWallet();

        // Verificar wallet
        if (address.toLowerCase() !== challenge.creator?.walletAddress?.toLowerCase() &&
            address.toLowerCase() !== challenge.opponent?.walletAddress?.toLowerCase()) {
          throw new Error("Wallet conectada no coincide con tu cuenta");
        }

        // Dirección de escrow
        const ESCROW_WALLET = process.env.NEXT_PUBLIC_ESCROW_WALLET || address;

        // USDT addresses por chain
        const { ethers } = await import("ethers");
        const USDT_ADDRESSES: Record<number, string> = {
          1: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
          11155111: "0x7b77F953299e815a81319b4beFd3EA4896c5F6dC",
          137: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
          56: "0x55d398326f99059fF775485246999027B3197955",
        };

        const usdtAddress = USDT_ADDRESSES[chainId] || USDT_ADDRESSES[1];
        const stakeWei = ethers.parseUnits(String(challenge.stakeAmount), 6);

        // Contrato USDT
        const erc20Abi = [
          "function transfer(address to, uint256 amount) returns (bool)",
          "function balanceOf(address) view returns (uint256)",
        ];
        const usdtContract = new ethers.Contract(usdtAddress, erc20Abi, signer);

        // Verificar balance
        setResult("Verificando balance de USDT…");
        const balance = await usdtContract.balanceOf(address);
        if (balance < stakeWei) {
          throw new Error(
            `Saldo insuficiente. Tienes ${ethers.formatUnits(balance, 6)} USDT, necesitas ${challenge.stakeAmount} USDT.`
          );
        }

        // Transferir USDT REAL
        setResult(`Transfiriendo ${challenge.stakeAmount} USDT… ¡Firma en MetaMask!`);
        const tx = await usdtContract.transfer(ESCROW_WALLET, stakeWei);
        setResult(`Tx enviada: ${tx.hash.slice(0, 20)}… Esperando confirmación…`);
        await tx.wait();

        // Guardar tx real
        const res = await fetch(`/api/challenges/${challenge.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "fund",
            userId: currentUserId,
            escrowAddress: ESCROW_WALLET,
            escrowTxHash: tx.hash,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        setResult(`✓ ${challenge.stakeAmount} USDT depositados. Tx: ${tx.hash.slice(0, 20)}…`);
        setTimeout(() => onUpdate(), 2000);
        return;
      }

      // ============================================================
      // CONFIRMAR RESULTADO + PAGO AL GANADOR
      // ============================================================
      if (action === "confirm-result") {
        const res = await fetch(`/api/challenges/${challenge.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, userId: currentUserId, ...extra }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        if (data.challenge?.winnerId) {
          const winner = data.challenge.winner;
          const payout = challenge.stakeAmount * 2 * 0.95;
          setResult(
            `✓ Ganador: ${winner?.alias}\n` +
            `✓ Pago: ${payout.toFixed(2)} USDT\n` +
            `✓ Wallet: ${winner?.walletAddress?.slice(0, 10)}…\n` +
            `✓ Tx depósito: ${challenge.escrowTxHash?.slice(0, 20)}…`
          );
        } else if (data.message) {
          setResult(data.message);
        }
        setTimeout(() => onUpdate(), 2500);
        return;
      }

      // ============================================================
      // Otras acciones
      // ============================================================
      const res = await fetch(`/api/challenges/${challenge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, userId: currentUserId, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (data.message) setResult(data.message);
      if (data.apiConfigured !== undefined) {
        setResult(
          data.message + (data.apiConfigured ? "" : "\n\n⚠️ Sin API key — usando mock.")
        );
      }
      setTimeout(() => onUpdate(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setResult("");
    } finally {
      setActionLoading(false);
    }
  }

  const canAccept =
    challenge.status === "OPEN" &&
    !isCreator &&
    userAccounts.some((a) => a.game === challenge.game);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-100 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-emerald-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <img src={getGameImageURL(challenge.game)} alt={adapter.name} className="w-8 h-8 rounded-lg" />
              {adapter.name}
            </span>
            <Badge variant="outline" className={`text-xs ${status.color}`}>
              {status.label}
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {challenge.mode} · {timeAgo(new Date(challenge.createdAt))}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Jugadores */}
          <div className="grid grid-cols-2 gap-2">
            <div className={`p-3 rounded-md bg-slate-950 border ${challenge.winner?.id === challenge.creator.id ? "border-yellow-700/50" : "border-slate-800"}`}>
              <div className="text-[10px] text-slate-500 uppercase mb-1">Creador</div>
              <div className="flex items-center gap-2">
                <Avatar className={`w-8 h-8 bg-gradient-to-br ${avatarGradient(challenge.creator.avatarSeed)}`}>
                  <AvatarFallback className="bg-transparent text-white text-[10px]">
                    {challenge.creator.alias.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="text-sm font-medium text-slate-100">
                    {challenge.creator.alias}
                    {isCreator && <span className="text-emerald-400 text-[10px] ml-1">(tú)</span>}
                  </div>
                  <div className="text-[10px] text-slate-500">★ {challenge.creator.reputationScore.toFixed(0)}</div>
                </div>
                {challenge.winner?.id === challenge.creator.id && (
                  <Trophy className="w-4 h-4 text-yellow-400 ml-auto" />
                )}
              </div>
            </div>

            <div className={`p-3 rounded-md bg-slate-950 border ${challenge.winner?.id === challenge.opponent?.id ? "border-yellow-700/50" : "border-slate-800"}`}>
              <div className="text-[10px] text-slate-500 uppercase mb-1">Oponente</div>
              {challenge.opponent ? (
                <div className="flex items-center gap-2">
                  <Avatar className={`w-8 h-8 bg-gradient-to-br ${avatarGradient(challenge.opponent.avatarSeed)}`}>
                    <AvatarFallback className="bg-transparent text-white text-[10px]">
                      {challenge.opponent.alias.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="text-sm font-medium text-slate-100">
                      {challenge.opponent.alias}
                      {isOpponent && <span className="text-emerald-400 text-[10px] ml-1">(tú)</span>}
                    </div>
                    <div className="text-[10px] text-slate-500">★ {challenge.opponent.reputationScore.toFixed(0)}</div>
                  </div>
                  {challenge.winner?.id === challenge.opponent.id && (
                    <Trophy className="w-4 h-4 text-yellow-400 ml-auto" />
                  )}
                </div>
              ) : (
                <div className="text-sm text-slate-500">Esperando oponente…</div>
              )}
            </div>
          </div>

          {/* Apuesta — honesto sobre qué es real */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">Apuesta</div>
              <div className="font-mono text-slate-200">{formatStake(challenge.stakeAmount)}</div>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">
                {challenge.escrowTxHash ? "Pool ✓" : "Pool (pend.)"}
              </div>
              <div className={`font-mono ${challenge.escrowTxHash ? "text-emerald-400" : "text-slate-600"}`}>
                {challenge.escrowTxHash
                  ? formatStake(totalPot(challenge.stakeAmount))
                  : "—"
                }
              </div>
            </div>
            <div className="p-2 rounded bg-slate-950 border border-slate-800">
              <div className="text-[10px] text-slate-500 uppercase">
                {challenge.payoutStatus === "COMPLETED" ? "Pagado ✓" : "Ganador (est.)"}
              </div>
              <div className={`font-mono ${challenge.payoutStatus === "COMPLETED" ? "text-yellow-400" : "text-slate-600"}`}>
                {challenge.escrowTxHash
                  ? winnerPayout(challenge.stakeAmount).toFixed(2)
                  : "—"
                }
              </div>
            </div>
          </div>

          {/* Acciones según estado */}
          {challenge.status === "OPEN" && canAccept && (
            <AcceptSection
              accounts={userAccounts.filter((a) => a.game === challenge.game)}
              onAccept={(accId) => doAction("accept", { opponentGameAccountId: accId })}
              loading={actionLoading}
            />
          )}

          {challenge.status === "ACCEPTED" && (isCreator || isOpponent) && (
            <div className="space-y-2">
              <Button
                onClick={() => doAction("fund")}
                disabled={actionLoading}
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white"
              >
              {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
                Depositar {challenge.stakeAmount} USDT (real vía MetaMask)
              </Button>
            </div>
          )}

          {challenge.status === "ESCROW_FUNDED" && (isCreator || isOpponent) && (
            <Button
              onClick={() => doAction("start")}
              disabled={actionLoading}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Swords className="w-4 h-4 mr-2" />
              Iniciar partido
            </Button>
          )}

          {challenge.status === "IN_PROGRESS" && (isCreator || isOpponent) && (
            adapter.verification === "API" ? (
              <div className="space-y-2">
                <Label className="text-slate-300 block text-xs">
                  ID del partido (match ID) en {adapter.shortName}
                </Label>
                <Input
                  value={matchId}
                  onChange={(e) => setMatchId(e.target.value)}
                  placeholder="ej: LA1_1234567890"
                  className="bg-slate-950 border-slate-700 text-slate-100 font-mono text-xs"
                />
                <Button
                  onClick={() => doAction("verify", { matchId })}
                  disabled={actionLoading || !matchId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                  Verificar resultado vía API
                </Button>
              </div>
            ) : (
              <SelfReportSection
                challenge={challenge}
                isCreator={isCreator}
                isOpponent={isOpponent}
                currentUserId={currentUserId}
                actionLoading={actionLoading}
                onReport={(winner, cid) => doAction("report-result", { reportedWinner: winner, screenshotCID: cid })}
                onConfirm={() => doAction("confirm-result", {})}
                onDispute={(reason) => doAction("dispute-result", { disputeReason: reason })}
                onCheckTimeout={() => doAction("check-timeout", {})}
                setResult={setResult}
              />
            )
          )}

          {challenge.status === "PENDING_CONFIRM" && (isCreator || isOpponent) && (
            <SelfReportSection
              challenge={challenge}
              isCreator={isCreator}
              isOpponent={isOpponent}
              currentUserId={currentUserId}
              actionLoading={actionLoading}
              onReport={(winner, cid) => doAction("report-result", { reportedWinner: winner, screenshotCID: cid })}
              onConfirm={() => doAction("confirm-result", {})}
              onDispute={(reason) => doAction("dispute-result", { disputeReason: reason })}
              onCheckTimeout={() => doAction("check-timeout", {})}
              setResult={setResult}
            />
          )}

          {["OPEN", "ACCEPTED", "ESCROW_FUNDED"].includes(challenge.status) && (isCreator || isOpponent) && (
            <Button
              onClick={() => doAction("cancel")}
              disabled={actionLoading}
              variant="outline"
              className="w-full border-slate-700 text-slate-400 hover:bg-slate-800"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Cancelar reto
            </Button>
          )}

          {result && (
            <div className="p-3 rounded-md bg-emerald-950/30 border border-emerald-900/50 text-xs text-emerald-300 whitespace-pre-line">
              <CheckCircle2 className="w-4 h-4 inline mr-1" />
              {result}
            </div>
          )}

          {/* Estado del pago automático */}
          {challenge.status === "COMPLETED" && challenge.winner && (
            <PayoutStatus challenge={challenge} />
          )}

          {error && (
            <div className="p-2 rounded-md bg-red-950/50 border border-red-900/50 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AcceptSection({
  accounts,
  onAccept,
  loading,
}: {
  accounts: GameAccount[];
  onAccept: (accId: string) => void;
  loading: boolean;
}) {
  const [accId, setAccId] = useState(accounts[0]?.id || "");

  if (accounts.length === 0) {
    return (
      <div className="p-3 rounded-md bg-yellow-950/30 border border-yellow-900/50 text-xs text-yellow-300">
        Vincula tu cuenta de este juego para aceptar el reto
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label className="text-slate-300 block text-xs">Tu cuenta para este reto</Label>
      <Select value={accId} onValueChange={setAccId}>
        <SelectTrigger className="bg-slate-950 border-slate-700 text-slate-100">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-700 text-slate-100">
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.accountName} ({a.accountRegion})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        onClick={() => onAccept(accId)}
        disabled={loading || !accId}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Swords className="w-4 h-4 mr-2" />}
        Aceptar reto
      </Button>
    </div>
  );
}

// ============================================================
// SelfReportSection — para juegos sin API (FIFA, CS2, CoD, etc.)
// ============================================================
function SelfReportSection({
  challenge,
  isCreator,
  currentUserId,
  actionLoading,
  onReport,
  onConfirm,
  onDispute,
  onCheckTimeout,
  setResult,
}: {
  challenge: Challenge;
  isCreator: boolean;
  isOpponent: boolean;
  currentUserId: string;
  actionLoading: boolean;
  onReport: (winner: "creator" | "opponent", screenshotCID: string) => void;
  onConfirm: () => void;
  onDispute: (reason: string) => void;
  onCheckTimeout: () => void;
  setResult: (s: string | null) => void;
}) {
  const [selectedWinner, setSelectedWinner] = useState<"creator" | "opponent">("creator");
  const [screenshotUploaded, setScreenshotUploaded] = useState(false);
  const [screenshotCID, setScreenshotCID] = useState("");
  const [disputeText, setDisputeText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [remainingTime, setRemainingTime] = useState("");

  // Timer para countdown
  useEffect(() => {
    if (challenge.status === "PENDING_CONFIRM" && challenge.resultDeadline) {
      const updateTimer = () => {
        const remaining = new Date(challenge.resultDeadline!).getTime() - Date.now();
        if (remaining <= 0) {
          setRemainingTime("⏰ Tiempo agotado");
          onCheckTimeout();
        } else {
          const min = Math.floor(remaining / 60000);
          const sec = Math.floor((remaining % 60000) / 1000);
          setRemainingTime(`${min}:${sec.toString().padStart(2, "0")}`);
        }
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [challenge.status, challenge.resultDeadline, onCheckTimeout]);

  // Subir screenshot a IPFS
  async function uploadScreenshot(file: File) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/ipfs?op=upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.cid) {
        setScreenshotCID(data.cid);
        setScreenshotUploaded(true);
        setResult("Screenshot subido a IPFS. CID: " + data.cid.slice(0, 12) + "...");
      }
    } catch (e) {
      setResult("Error subiendo screenshot: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  // Si ya se reportó y estamos esperando confirmación
  if (challenge.status === "PENDING_CONFIRM") {
    const isLoser = challenge.reportedWinner === "creator"
      ? challenge.opponent?.id === currentUserId
      : challenge.creator?.id === currentUserId;

    return (
      <div className="space-y-3">
        <div className="p-3 rounded-md bg-blue-950/30 border border-blue-900/50">
          <div className="text-xs text-blue-300 font-medium mb-1">
            ⏳ Resultado reportado — Esperando confirmación
          </div>
          <div className="text-[10px] text-slate-400 mb-2">
            Ganador reportado: <strong className="text-emerald-400">
              {challenge.reportedWinner === "creator" ? challenge.creator.alias : challenge.opponent?.alias}
            </strong>
          </div>
          {remainingTime && (
            <div className="text-xs font-mono text-yellow-400">
              Tiempo restante: {remainingTime}
            </div>
          )}
          {challenge.resultScreenshot && (
            <a
              href={`https://ipfs.io/ipfs/${challenge.resultScreenshot}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-400 hover:underline mt-1 inline-block"
            >
              📎 Ver screenshot en IPFS
            </a>
          )}
        </div>

        {isLoser ? (
          <div className="space-y-2">
            <Button
              onClick={onConfirm}
              disabled={actionLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Confirmar resultado (soy el perdedor)
            </Button>
            <div className="space-y-1">
              <textarea
                value={disputeText}
                onChange={(e) => setDisputeText(e.target.value)}
                placeholder="Si disputa, explique por qué (ej: el screenshot es falso, el resultado fue diferente...)"
                className="w-full bg-slate-950 border border-slate-700 text-slate-100 text-xs p-2 rounded-md"
                rows={2}
              />
              <Button
                onClick={() => onDispute(disputeText)}
                disabled={actionLoading || !disputeText.trim()}
                variant="outline"
                className="w-full border-red-900/50 text-red-400 hover:bg-red-950/30"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Disputar resultado
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-2 rounded-md bg-slate-950 border border-slate-800 text-xs text-slate-400 text-center">
            Esperando que el oponente confirme o dispute...
          </div>
        )}
      </div>
    );
  }

  // Si está en progreso y es self-report
  return (
    <div className="space-y-3">
      <div className="p-3 rounded-md bg-purple-950/20 border border-purple-900/40">
        <div className="text-xs text-purple-300 font-medium mb-1">
          📸 Self-report — Este juego no tiene API automática
        </div>
        <p className="text-[10px] text-slate-400">
          1. Jueguen el partido<br/>
          2. El ganador sube un screenshot del resultado<br/>
          3. El perdedor tiene 10 min para confirmar o disputar<br/>
          4. Si no responde en 10 min → el ganador recibe el pago
        </p>
      </div>

      <div>
        <Label className="text-slate-300 mb-1.5 block text-xs">¿Quién ganó?</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setSelectedWinner("creator")}
            className={`p-2 rounded-md border text-xs font-medium transition ${
              selectedWinner === "creator"
                ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            {challenge.creator.alias} (tú{isCreator ? "" : " — creador"})
          </button>
          <button
            onClick={() => setSelectedWinner("opponent")}
            className={`p-2 rounded-md border text-xs font-medium transition ${
              selectedWinner === "opponent"
                ? "bg-emerald-950/40 border-emerald-700 text-emerald-300"
                : "bg-slate-950 border-slate-800 text-slate-400"
            }`}
          >
            {challenge.opponent?.alias || "Oponente"}
          </button>
        </div>
      </div>

      <div>
        <Label className="text-slate-300 mb-1.5 block text-xs">
          Screenshot del resultado (subir a IPFS)
        </Label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadScreenshot(file);
          }}
          className="w-full text-xs text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-emerald-600 file:text-white file:text-xs file:cursor-pointer"
        />
        {uploading && (
          <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            Subiendo a IPFS...
          </div>
        )}
        {screenshotUploaded && (
          <div className="text-[10px] text-emerald-400 mt-1">
            ✓ Screenshot subido. CID: {screenshotCID.slice(0, 20)}...
          </div>
        )}
      </div>

      <Button
        onClick={() => onReport(selectedWinner, screenshotCID)}
        disabled={actionLoading || !screenshotUploaded}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {actionLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
        Reportar resultado
      </Button>
    </div>
  );
}

// ============================================================
// PayoutStatus — muestra el estado del pago automático al ganador
// ============================================================
function PayoutStatus({ challenge }: { challenge: Challenge }) {
  const status = challenge.payoutStatus || "PENDING";
  const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
    PENDING: { label: "Pago pendiente", color: "bg-yellow-950/30 border-yellow-900/50 text-yellow-300", icon: "⏳" },
    PROCESSING: { label: "Procesando pago…", color: "bg-blue-950/30 border-blue-900/50 text-blue-300", icon: "🔄" },
    COMPLETED: { label: "Pago completado", color: "bg-emerald-950/30 border-emerald-900/50 text-emerald-300", icon: "✓" },
    FAILED: { label: "Pago falló", color: "bg-red-950/30 border-red-900/50 text-red-300", icon: "❌" },
  };
  const config = statusConfig[status] || statusConfig.PENDING;
  const payout = challenge.payoutAmount || challenge.stakeAmount * 2 * 0.95;

  return (
    <div className={`p-3 rounded-md border text-xs ${config.color}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{config.icon} {config.label}</span>
        {status === "COMPLETED" && (
          <span className="font-mono">{payout.toFixed(2)} USDT</span>
        )}
      </div>
      {status === "PENDING" && (
        <p className="text-[10px] opacity-80">
          El bot de pago automático enviará {payout.toFixed(2)} USDT a {challenge.winner?.alias} en breve.
        </p>
      )}
      {status === "PROCESSING" && (
        <p className="text-[10px] opacity-80">Transfiriendo USDT al ganador…</p>
      )}
      {status === "COMPLETED" && challenge.payoutTxHash && (
        <div className="text-[10px] opacity-80">
          <div>Wallet: {challenge.winner?.walletAddress?.slice(0, 10)}…</div>
          <a
            href={`https://etherscan.io/tx/${challenge.payoutTxHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline"
          >
            Ver tx: {challenge.payoutTxHash.slice(0, 20)}…
          </a>
        </div>
      )}
      {status === "FAILED" && challenge.payoutError && (
        <p className="text-[10px] opacity-80">Error: {challenge.payoutError}</p>
      )}
    </div>
  );
}
