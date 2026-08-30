// ============================================================
// Steam Web API - CS2 y Dota 2
// ============================================================
// Verifica resultados reales de partidas consultando Steam API.
//
// Requiere API key de https://steamcommunity.com/dev/apikey (gratis)
// Configurar en .env: STEAM_API_KEY=xxxxx
//
// Nota: Steam no expone match results de CS2 públicamente.
// Para CS2 usamos FACEIT API o tracker.gg como alternativa.
// Para Dota 2 sí hay endpoint oficial: GetMatchDetails.

const STEAM_API_KEY = process.env.STEAM_API_KEY || "";
const STEAM_BASE = "https://api.steampowered.com";

export interface SteamMatchResult {
  matchId: string;
  game: "COUNTER_STRIKE_2" | "DOTA2";
  duration: number;
  winner: "creator" | "opponent" | "draw" | "unknown";
  radiantWin?: boolean; // Dota 2
  players?: Array<{
    accountId: string;
    kills: number;
    deaths: number;
    assists: number;
    isRadiant: boolean;
  }>;
  verifiedAt: number;
  source: string;
}

function isConfigured(): boolean {
  return STEAM_API_KEY.length > 10;
}

// ============================================================
// Resolver vanity URL a Steam ID
// ============================================================
export async function resolveSteamId(vanityUrl: string): Promise<string | null> {
  if (!isConfigured()) return null;
  try {
    const res = await fetch(
      `${STEAM_BASE}/ISteamUser/ResolveVanityURL/v1/?key=${STEAM_API_KEY}&vanityurl=${encodeURIComponent(vanityUrl)}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.response.success === 1) return data.response.steamid;
    return null;
  } catch {
    return null;
  }
}

// ============================================================
// Obtener resultado de match de Dota 2
// ============================================================
export async function getDota2MatchResult(
  matchId: string,
  creatorSteamId: string,
  opponentSteamId: string
): Promise<SteamMatchResult | null> {
  if (!isConfigured()) return null;
  try {
    // GetMatchDetails
    const res = await fetch(
      `${STEAM_BASE}/IDOTA2Match_570/GetMatchDetails/v1/?key=${STEAM_API_KEY}&match_id=${matchId}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const match = data.result;
    if (!match) return null;

    const players = (match.players || []).map(
      (p: { account_id: number; kills: number; deaths: number; assists: number; player_slot: number }) => ({
        accountId: String(p.account_id),
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        isRadiant: p.player_slot < 128,
      })
    );

    const creator = players.find(
      (p: { accountId: string }) => p.accountId === creatorSteamId
    );
    const opponent = players.find(
      (p: { accountId: string }) => p.accountId === opponentSteamId
    );

    let winner: SteamMatchResult["winner"] = "unknown";
    if (creator && opponent) {
      const radiantWon = match.radiant_win;
      if (creator.isRadiant === radiantWon && opponent.isRadiant !== radiantWon) {
        winner = "creator";
      } else if (opponent.isRadiant === radiantWon && creator.isRadiant !== radiantWon) {
        winner = "opponent";
      } else {
        winner = "draw";
      }
    }

    return {
      matchId,
      game: "DOTA2",
      duration: match.duration || 0,
      winner,
      radiantWin: match.radiant_win,
      players,
      verifiedAt: Date.now(),
      source: "steam-api",
    };
  } catch {
    return null;
  }
}

// ============================================================
// CS2: No hay API pública oficial de Valve para match results.
// Alternativas:
// 1. FACEIT API (requiere API key de developers.faceit.com)
// 2. tracker.gg API (no oficial)
// 3. Self-report con verificación cruzada de demo
//
// Para MVP, usamos FACEIT si hay API key configurada.
// ============================================================
export async function getCS2MatchResult(
  matchId: string,
  _creatorSteamId: string,
  _opponentSteamId: string
): Promise<SteamMatchResult | null> {
  // FACEIT integration (pendiente)
  // Por ahora devolvemos null para que use el fallback mock
  return null;
}

export { isConfigured as isSteamConfigured };
