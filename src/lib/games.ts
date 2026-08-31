// ============================================================
// Arquitectura extensible de juegos para Retos P2P
// ============================================================
// Cada juego implementa la interfaz GameAdapter. Para añadir un
// juego nuevo, solo crea un adapter y regístralo en GAME_ADAPTERS.
//
// El resto del sistema (UI, API, escrow) no necesita cambios.

export type GameType = "LEAGUE_OF_LEGENDS" | "VALORANT" | "COUNTER_STRIKE_2" | "DOTA2" | "ROCKET_LEAGUE";

export interface GameAdapter {
  type: GameType;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  regions: Array<{ code: string; name: string }>;
  modes: Array<{ id: string; name: string; description: string }>;
  accountInputLabel: string;
  accountRegionLabel: string;
  accountNamePlaceholder: string;
  // En producción: cada adapter tiene su cliente de API oficial
  // verifyMatchResult(matchId: string, accounts: [string, string]): Promise<MatchResult>
}

export interface MatchResult {
  matchId: string;
  game: GameType;
  duration: number; // segundos
  winner: "creator" | "opponent" | "draw";
  scoreCreator: number;
  scoreOpponent: number;
  stats?: Record<string, unknown>;
  verifiedAt: number;
  source: string;
}

// ============================================================
// ADAPTER: League of Legends (Riot Games API)
// ============================================================
const LOL_ADAPTER: GameAdapter = {
  type: "LEAGUE_OF_LEGENDS",
  name: "League of Legends",
  shortName: "LoL",
  icon: "⚔️",
  color: "#c89b3c",
  regions: [
    { code: "la1", name: "LAN (Latam North)" },
    { code: "la2", name: "LAS (Latam South)" },
    { code: "br1", name: "Brasil" },
    { code: "na1", name: "Norteamérica" },
    { code: "euw1", name: "Europa Oeste" },
    { code: "eun1", name: "Europa Nórdica/Este" },
    { code: "kr", name: "Corea" },
  ],
  modes: [
    { id: "1v1-custom", name: "1v1 Custom", description: "Partida custom, primer sangre o torre" },
    { id: "1v1-rank", name: "1v1 Solo Q", description: "Partida ranked, gana quien suba más" },
    { id: "bo3", name: "Best of 3", description: "Mejor de 3 partidas" },
  ],
  accountInputLabel: "Nombre de invocador",
  accountRegionLabel: "Región del invocador",
  accountNamePlaceholder: "ej: Faker#KR1",
};

// ============================================================
// ADAPTER: Valorant (Riot Games API)
// ============================================================
const VALORANT_ADAPTER: GameAdapter = {
  type: "VALORANT",
  name: "Valorant",
  shortName: "VAL",
  icon: "🎯",
  color: "#ff4655",
  regions: [
    { code: "na", name: "Norteamérica" },
    { code: "eu", name: "Europa" },
    { code: "kr", name: "Corea" },
    { code: "ap", name: "Asia-Pacífico" },
    { code: "br", name: "Brasil" },
    { code: "latam", name: "Latam" },
  ],
  modes: [
    { id: "1v1-deathmatch", name: "1v1 Deathmatch", description: "Primero en 10 kills" },
    { id: "1v1-spike", name: "1v1 Spike", description: "Mejor de 5 rondas" },
    { id: "bo3", name: "Best of 3", description: "Mejor de 3 mapas" },
  ],
  accountInputLabel: "Riot ID (nombre#tag)",
  accountRegionLabel: "Región",
  accountNamePlaceholder: "ej: TenZ#sen",
};

// ============================================================
// ADAPTER: Counter-Strike 2 (Steam Web API)
// ============================================================
const CS2_ADAPTER: GameAdapter = {
  type: "COUNTER_STRIKE_2",
  name: "Counter-Strike 2",
  shortName: "CS2",
  icon: "🔫",
  color: "#f7a800",
  regions: [
    { code: "global", name: "Global" },
  ],
  modes: [
    { id: "1v1-aim", name: "1v1 Aim Map", description: "Primero en 16 kills" },
    { id: "1v1-pistol", name: "1v1 Pistols Only", description: "Solo pistolas, 16 kills" },
    { id: "bo3", name: "Best of 3 maps", description: "Mejor de 3 mapas" },
  ],
  accountInputLabel: "Steam ID o URL",
  accountRegionLabel: "Región",
  accountNamePlaceholder: "ej: 76561198012345678",
};

// ============================================================
// ADAPTER: Dota 2 (Steam Web API) — para futuro
// ============================================================
const DOTA2_ADAPTER: GameAdapter = {
  type: "DOTA2",
  name: "Dota 2",
  shortName: "DOTA",
  icon: "🛡️",
  color: "#a82828",
  regions: [{ code: "global", name: "Global" }],
  modes: [
    { id: "1v1-mid", name: "1v1 Mid", description: "Solo mid, primer torre o 2 kills" },
  ],
  accountInputLabel: "Steam ID",
  accountRegionLabel: "Región",
  accountNamePlaceholder: "ej: 76561198012345678",
};

// ============================================================
// REGISTRO DE ADAPTERS
// ============================================================
export const GAME_ADAPTERS: Record<GameType, GameAdapter> = {
  LEAGUE_OF_LEGENDS: LOL_ADAPTER,
  VALORANT: VALORANT_ADAPTER,
  COUNTER_STRIKE_2: CS2_ADAPTER,
  DOTA2: DOTA2_ADAPTER,
  ROCKET_LEAGUE: {
    type: "ROCKET_LEAGUE",
    name: "Rocket League",
    shortName: "RL",
    icon: "🚗",
    color: "#0099ff",
    regions: [{ code: "global", name: "Global" }],
    modes: [
      { id: "1v1", name: "1v1 Solo", description: "1v1 estándar, 5 min" },
    ],
    accountInputLabel: "Epic Games ID",
    accountRegionLabel: "Región",
    accountNamePlaceholder: "ej: username",
  },
};

export function getGameAdapter(game: GameType | string): GameAdapter {
  const adapter = GAME_ADAPTERS[game as GameType];
  if (!adapter) {
    // Fallback al primer juego si no se encuentra
    return LOL_ADAPTER;
  }
  return adapter;
}

export function getAllGames(): GameAdapter[] {
  return Object.values(GAME_ADAPTERS);
}

// ============================================================
// Verificación de resultado — intenta API real, fallback a mock
// ============================================================
// En producción:
//   - LoL/Valorant: Riot Games API (RIOT_API_KEY en .env)
//   - Dota2: Steam Web API (STEAM_API_KEY en .env)
//   - CS2: No hay API pública (usar FACEIT o self-report)
//
// Si no hay API key configurada, usa mock determinista.

export async function verifyMatchResult(
  game: GameType | string,
  matchId: string,
  creatorAccountId: string,
  opponentAccountId: string
): Promise<MatchResult> {
  const adapter = getGameAdapter(game);
  const gameType = adapter.type;

  // Intentar API real según el juego
  try {
    if (gameType === "LEAGUE_OF_LEGENDS") {
      const { getLoLMatchResult, isRiotConfigured } = await import("./riot-api");
      if (isRiotConfigured()) {
        const result = await getLoLMatchResult(
          matchId,
          creatorAccountId,
          opponentAccountId
        );
        if (result) {
          return {
            matchId,
            game: gameType,
            duration: result.duration,
            winner: result.winner as "creator" | "opponent" | "draw",
            scoreCreator: result.participants.find(p => p.puuid === creatorAccountId)?.kills || 0,
            scoreOpponent: result.participants.find(p => p.puuid === opponentAccountId)?.kills || 0,
            stats: { source: "riot-api", participants: result.participants.length },
            verifiedAt: result.verifiedAt,
            source: result.source,
          };
        }
      }
    } else if (gameType === "VALORANT") {
      const { getValorantMatchResult, isRiotConfigured } = await import("./riot-api");
      if (isRiotConfigured()) {
        const result = await getValorantMatchResult(
          matchId,
          creatorAccountId,
          opponentAccountId
        );
        if (result) {
          return {
            matchId,
            game: gameType,
            duration: result.duration,
            winner: result.winner as "creator" | "opponent" | "draw",
            scoreCreator: result.participants.find(p => p.puuid === creatorAccountId)?.kills || 0,
            scoreOpponent: result.participants.find(p => p.puuid === opponentAccountId)?.kills || 0,
            stats: { source: "riot-api", participants: result.participants.length },
            verifiedAt: result.verifiedAt,
            source: result.source,
          };
        }
      }
    } else if (gameType === "DOTA2") {
      const { getDota2MatchResult, isSteamConfigured } = await import("./steam-api");
      if (isSteamConfigured()) {
        const result = await getDota2MatchResult(
          matchId,
          creatorAccountId,
          opponentAccountId
        );
        if (result) {
          return {
            matchId,
            game: gameType,
            duration: result.duration,
            winner: result.winner as "creator" | "opponent" | "draw",
            scoreCreator: result.players?.find(p => p.accountId === creatorAccountId)?.kills || 0,
            scoreOpponent: result.players?.find(p => p.accountId === opponentAccountId)?.kills || 0,
            stats: { source: "steam-api", radiantWin: result.radiantWin },
            verifiedAt: result.verifiedAt,
            source: result.source,
          };
        }
      }
    } else if (gameType === "COUNTER_STRIKE_2") {
      const { getCS2MatchResult } = await import("./steam-api");
      const result = await getCS2MatchResult(
        matchId,
        creatorAccountId,
        opponentAccountId
      );
      if (result) {
        return {
          matchId,
          game: gameType,
          duration: result.duration,
          winner: result.winner as "creator" | "opponent" | "draw",
          scoreCreator: 0,
          scoreOpponent: 0,
          stats: { source: result.source },
          verifiedAt: result.verifiedAt,
          source: result.source,
        };
      }
    }
  } catch (e) {
    console.warn(`[verifyMatchResult] API real falló para ${gameType}:`, e);
  }

  // Fallback: mock determinista (para desarrollo sin API keys)
  const hash = (matchId || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const winner: "creator" | "opponent" | "draw" =
    hash % 3 === 0 ? "creator" : hash % 3 === 1 ? "opponent" : "draw";

  return {
    matchId,
    game: adapter.type,
    duration: 300 + (hash % 600),
    winner,
    scoreCreator: winner === "creator" ? 16 : winner === "opponent" ? 8 : 12,
    scoreOpponent: winner === "opponent" ? 16 : winner === "creator" ? 8 : 12,
    stats: {
      creatorAccountId,
      opponentAccountId,
      mode: "1v1",
      warning: "Resultado simulado (sin API key configurada)",
    },
    verifiedAt: Date.now(),
    source: `mock-${adapter.shortName}`,
  };
}

// Verificar si un juego tiene API real configurada
export function isGameAPIConfigured(game: GameType | string): boolean {
  const adapter = getGameAdapter(game);
  switch (adapter.type) {
    case "LEAGUE_OF_LEGENDS":
    case "VALORANT":
      return process.env.RIOT_API_KEY?.startsWith("RGAPI-") || false;
    case "DOTA2":
    case "COUNTER_STRIKE_2":
      return (process.env.STEAM_API_KEY?.length || 0) > 10;
    default:
      return false;
  }
}

// ============================================================
// Helpers
// ============================================================

export function formatStake(amount: number, currency = "USDT"): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function totalPot(stake: number): number {
  return stake * 2; // ambos jugadores apuestan lo mismo
}

export function winnerPayout(stake: number): number {
  return stake * 2 * 0.95; // 5% comisión de plataforma
}

export function challengeStatusLabels(status: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    OPEN: { label: "Abierto", color: "bg-emerald-950/50 text-emerald-400 border-emerald-700/50" },
    ACCEPTED: { label: "Aceptado", color: "bg-blue-950/50 text-blue-400 border-blue-700/50" },
    ESCROW_FUNDED: { label: "Escrow fondeado", color: "bg-cyan-950/50 text-cyan-400 border-cyan-700/50" },
    IN_PROGRESS: { label: "En juego", color: "bg-yellow-950/50 text-yellow-400 border-yellow-700/50" },
    PENDING_RESULT: { label: "Verificando", color: "bg-purple-950/50 text-purple-400 border-purple-700/50" },
    COMPLETED: { label: "Completado", color: "bg-emerald-950/50 text-emerald-400 border-emerald-700/50" },
    CANCELLED: { label: "Cancelado", color: "bg-slate-950/50 text-slate-400 border-slate-700/50" },
    DISPUTED: { label: "Disputa", color: "bg-red-950/50 text-red-400 border-red-700/50" },
  };
  return map[status] || { label: status, color: "bg-slate-950/50 text-slate-400 border-slate-700/50" };
}
