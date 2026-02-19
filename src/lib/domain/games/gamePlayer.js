import { headers } from "next/headers";

function getBaseUrl() {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

async function fetchJson(path) {
  const baseUrl = getBaseUrl();
  const res = await fetch(`${baseUrl}${path}`, { cache: "no-store" });
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(json?.message ?? `Request failed (${res.status})`);
  return json;
}

export const gamePlayerServer = {
  async loadWithLevels(gameId) {
    const gameRes = await fetchJson(`/api/games/${gameId}?mode=play`);
    const levelsRes = await fetchJson(`/api/games/${gameId}/levels`);
    return {
      game: gameRes.game ?? gameRes,
      levels: levelsRes.levels ?? [],
    };
  },
};
