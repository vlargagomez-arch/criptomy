// ============================================================
// PUBG API - PlayerUnknown's Battlegrounds
// ============================================================
// API oficial de PUBG. No expira (Production key).
// Registra tu app en https://developer.pubg.com (gratis)
// Configurar: PUBG_API_KEY=eyJ0eXAiOi...

const PUBG_BASE = "https://api.pubg.com";

function getApiKey(): string {
  return process.env.PUBG_API_KEY || "";
}

export function isPubgConfigured(): boolean {
  return getApiKey().length > 20;
}

export interface PubgMatchParticipant {
  name: string;
  playerId: string;
  winPlace: number; // 1 = ganador
  kills: number;
  damage: number;
}

export interface PubgMatchResult {
  matchId: string;
  participants: PubgMatchParticipant[];
  winner: "creator" | "opponent" | "draw" | "unknown";
  mapName: string;
  duration: number;
  verifiedAt: number;
  source: string;
}

// ============================================================
// Obtener resultado de un match de PUBG
// ============================================================
export async function getPubgMatchResult(
  matchId: string,
  region: string,
  creatorPlayerId: string,
  opponentPlayerId: string
): Promise<PubgMatchResult | null> {
  if (!isPubgConfigured()) return null;

  try {
    const res = await fetch(
      `${PUBG_BASE}/shards/${region}/matches/${matchId}`,
      {
        headers: {
          Authorization: `Bearer ${getApiKey()}`,
          Accept: "application/vnd.api+json",
        },
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!res.ok) return null;
    const data = await res.json();

    // Extraer participantes del match
    const participants: PubgMatchParticipant[] = (data.included || [])
      .filter((item: { type: string }) => item.type === "participant")
      .map((item: { attributes: { stats: { name: string; playerId: string; winPlace: number; kills: number; damageDealt: number } } }) => ({
        name: item.attributes.stats.name,
        playerId: item.attributes.stats.playerId,
        winPlace: item.attributes.stats.winPlace,
        kills: item.attributes.stats.kills,
        damage: Math.round(item.attributes.stats.damageDealt || 0),
      }));

    const creator = participants.find(
      (p) => p.playerId === creatorPlayerId || p.name === creatorPlayerId
    );
    const opponent = participants.find(
      (p) => p.playerId === opponentPlayerId || p.name === opponentPlayerId
    );

    let winner: PubgMatchResult["winner"] = "unknown";
    if (creator && opponent) {
      if (creator.winPlace < opponent.winPlace) winner = "creator";
      else if (opponent.winPlace < creator.winPlace) winner = "opponent";
      else winner = "draw";
    }

    return {
      matchId,
      participants,
      winner,
      mapName: data.data?.attributes?.mapName || "unknown",
      duration: data.data?.attributes?.duration || 0,
      verifiedAt: Date.now(),
      source: "pubg-api",
    };
  } catch (e) {
    console.error("[pubg] error:", e);
    return null;
  }
}
