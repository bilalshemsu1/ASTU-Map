import { campus } from "./graph";
import type { Poi, Room } from "./types";

export type SearchResult = {
  poi: Poi;
  room?: Room;
  score: number;
};

function norm(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Very small fuzzy matcher: subsequence score with prefix bonus. */
function matchScore(query: string, target: string): number {
  const q = norm(query);
  const t = norm(target);
  if (!q) return 0;
  if (t.startsWith(q)) return 100 + q.length;
  if (t.includes(q)) return 60 + q.length;
  // subsequence
  let ti = 0;
  for (let qi = 0; qi < q.length && ti < t.length; qi++) {
    if (q[qi] === t[ti]) ti++;
  }
  if (ti === q.length) return 30 + q.length;
  return 0;
}

export function searchCampus(query: string): SearchResult[] {
  const q = norm(query);
  if (!q) return [];
  const results: SearchResult[] = [];

  for (const poi of campus.pois) {
    const targets: Array<[string, Room?]> = [[poi.name, undefined]];
    for (const a of poi.aliases ?? []) targets.push([a, undefined]);
    for (const r of poi.rooms ?? []) targets.push([r.number, r]);
    let best = 0;
    let bestRoom: Room | undefined;
    for (const [t, room] of targets) {
      const score = matchScore(q, t);
      if (score > best) {
        best = score;
        bestRoom = room;
      }
    }
    if (best > 0) results.push({ poi, room: bestRoom, score: best });
  }

  return results.sort((a, b) => b.score - a.score);
}