// ============================================================
// Riot Games API - LoL y Valorant
// ============================================================
// Verifica resultados reales de partidas consultando la API oficial.
//
// Requiere API key de https://developer.riotgames.com (gratis)
// Configurar en .env: RIOT_API_KEY=RGAPI-xxxxx
//
// Endpoints usados:
// - GET /lol/match/v5/matches/{matchId} — info completa del match
// - GET /riot/account/v1/accounts/by-riot-id/{name}/{tag} — obtener PUUID

const RIOT_API_KEY = process.env.RIOT_API_KEY || "";
const RIOT_BASE = "https://americas.api.riotgames.com"; // para match v5
const RIOT_REGIONAL: Record<string, string> = {
  la1: "https://la1.api.riotgames.com",
  la2: "https://la2.api.riotgames.com",
  br1: "https://br1.api.riotgames.com",
  na1: "https://na1.api.riotgames.com",
  euw1: "https://euw1.api.riotgames.com",
  eun1: "https://eun1.api.riotgames.com",
  kr: "https://kr.api.riotgames.com",
};

export interface RiotMatchParticipant {
  puuid: string;
  riotIdGameName: string;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  championName?: string; // LoL
  characterId?: string; // Valorant
  teamId: number;
}

export interface RiotMatchResult {
  matchId: string;
  game: "LEAGUE_OF_LEGENDS" | "VALORANT";
  duration: number;
  participants: RiotMatchParticipant[];
  winner: "creator" | "opponent" | "draw" | "unknown";
  verifiedAt: number;
  source: string;
}

function isConfigured(): boolean {
  return RIOT_API_KEY.startsWith("RGAPI-");
}

// ============================================================
// Resolver Riot ID (name#tag) a PUUID
// ============================================================
export async function resolveRiotId(
  gameName: string,
  tagLine: string
): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(
      `${RIOT_BASE}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(
        gameName
      )}/${encodeURIComponent(tagLine)}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.puuid;
  } catch {
    return null;
  }
}

// ============================================================
// Obtener resultado de un match de LoL
// ============================================================
export async function getLoLMatchResult(
  matchId: string,
  creatorPuuid: string,
  opponentPuuid: string
): Promise<RiotMatchResult | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(
      `${RIOT_BASE}/lol/match/v5/matches/${matchId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const participants: RiotMatchParticipant[] = data.info.participants.map(
      (p: {
        puuid: string;
        riotIdGameName: string;
        win: boolean;
        kills: number;
        deaths: number;
        assists: number;
        championName: string;
        teamId: number;
      }) => ({
        puuid: p.puuid,
        riotIdGameName: p.riotIdGameName,
        win: p.win,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        championName: p.championName,
        teamId: p.teamId,
      })
    );

    const creator = participants.find((p) => p.puuid === creatorPuuid);
    const opponent = participants.find((p) => p.puuid === opponentPuuid);

    let winner: RiotMatchResult["winner"] = "unknown";
    if (creator && opponent) {
      if (creator.win && !opponent.win) winner = "creator";
      else if (!creator.win && opponent.win) winner = "opponent";
      else winner = "draw";
    }

    return {
      matchId,
      game: "LEAGUE_OF_LEGENDS",
      duration: data.info.gameDuration || 0,
      participants,
      winner,
      verifiedAt: Date.now(),
      source: "riot-api",
    };
  } catch {
    return null;
  }
}

// ============================================================
// Obtener resultado de un match de Valorant
// ============================================================
export async function getValorantMatchResult(
  matchId: string,
  creatorPuuid: string,
  opponentPuuid: string
): Promise<RiotMatchResult | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(
      `${RIOT_BASE}/val/match/v1/matches/${matchId}`,
      {
        headers: { "X-Riot-Token": RIOT_API_KEY },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const players = data.players || [];
    const participants: RiotMatchParticipant[] = players.map(
      (p: {
        puuid: string;
        gameName: string;
        stats: { kills: number; deaths: number; assists: number };
        teamId: string;
      }) => ({
        puuid: p.puuid,
        riotIdGameName: p.gameName,
        win: false, // se determina por team
        kills: p.stats.kills,
        deaths: p.stats.deaths,
        assists: p.stats.assists,
        characterId: "",
        teamId: parseInt(p.teamId) || 0,
      })
    );

    // Determinar equipo ganador
    const teams = data.teams || [];
    const winningTeam = teams.find((t: { won: boolean }) => t.won);
    if (winningTeam) {
      participants.forEach((p) => {
        if (p.teamId === parseInt(winningTeam.teamId)) p.win = true;
      });
    }

    const creator = participants.find((p) => p.puuid === creatorPuuid);
    const opponent = participants.find((p) => p.puuid === opponentPuuid);

    let winner: RiotMatchResult["winner"] = "unknown";
    if (creator && opponent) {
      if (creator.win && !opponent.win) winner = "creator";
      else if (!creator.win && opponent.win) winner = "opponent";
      else winner = "draw";
    }

    return {
      matchId,
      game: "VALORANT",
      duration: data.matchInfo?.gameLengthMillis || 0,
      participants,
      winner,
      verifiedAt: Date.now(),
      source: "riot-api",
    };
  } catch {
    return null;
  }
}

export { isConfigured as isRiotConfigured };
