import campusJson from "./campus.json";
import type { CampusData, LatLng, Poi } from "./types";

export const campus: CampusData = campusJson as CampusData;

const R = 6371008.8; // mean Earth radius (m)

/** Great-circle distance in meters between two lat/lng points. */
export function haversine(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Round coordinate to ~0.1 m so near-identical road nodes merge. */
function keyOf(p: LatLng): string {
  return `${Math.round(p.lat * 1e6)},${Math.round(p.lon * 1e6)}`;
}

// ---- Build the road graph from OSM ways ----
const nodeIdByCoord = new Map<string, string>();
const coordByNodeId = new Map<string, LatLng>();
const adjacency = new Map<string, Map<string, number>>();

function nodeIdFor(p: LatLng): string {
  const k = keyOf(p);
  let id = nodeIdByCoord.get(k);
  if (!id) {
    id = `${k}`;
    nodeIdByCoord.set(k, id);
    coordByNodeId.set(id, { lat: p.lat, lon: p.lon });
    adjacency.set(id, new Map());
  }
  return id;
}

function addEdge(a: LatLng, b: LatLng) {
  const idA = nodeIdFor(a);
  const idB = nodeIdFor(b);
  if (idA === idB) return;
  const m = haversine(a, b);
  adjacency.get(idA)!.set(idB, m);
  adjacency.get(idB)!.set(idA, m);
}

for (const road of campus.roads) {
  for (let i = 0; i < road.path.length - 1; i++) addEdge(road.path[i], road.path[i + 1]);
}

// ---- Snap POIs to nearest road node ----
const poiNode = new Map<string, string>();
export const poiById = new Map<string, Poi>(campus.pois.map((p) => [p.id, p]));

for (const poi of campus.pois) {
  let best: string | null = null;
  let bestD = Infinity;
  for (const [id, c] of coordByNodeId) {
    const d = haversine(poi, c);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  if (best) poiNode.set(poi.id, best);
}

/** The road-graph node id a POI routes through. */
export function poiNodeId(poiId: string): string | undefined {
  return poiNode.get(poiId);
}

/** Coordinates of a road-graph node id. */
export function nodeCoord(id: string): LatLng | undefined {
  return coordByNodeId.get(id);
}

export type RouteResult = {
  nodeIds: string[];
  coords: LatLng[];
  meters: number;
};

/** Dijkstra over the real OSM road graph between two road-node ids. */
export function shortestPathByNodeId(startId: string, goalId: string): RouteResult | null {
  if (startId === goalId) {
    const c = coordByNodeId.get(startId)!;
    return { nodeIds: [startId], coords: [c], meters: 0 };
  }

  const prev = new Map<string, string>();
  const distTo = new Map<string, number>([[startId, 0]]);
  const visited = new Set<string>();
  const queue = new Set<string>([startId]);

  while (queue.size > 0) {
    let current = "";
    let best = Infinity;
    for (const id of queue) {
      const d = distTo.get(id) ?? Infinity;
      if (d < best) {
        best = d;
        current = id;
      }
    }
    if (!current || best === Infinity) break;
    queue.delete(current);
    if (current === goalId) break;
    visited.add(current);

    for (const [next, w] of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      const alt = (distTo.get(current) ?? Infinity) + w;
      if (alt < (distTo.get(next) ?? Infinity)) {
        distTo.set(next, alt);
        prev.set(next, current);
        queue.add(next);
      }
    }
  }

  if (!distTo.has(goalId)) return null;

  const nodeIds: string[] = [];
  let cur: string | undefined = goalId;
  while (cur !== undefined) {
    nodeIds.unshift(cur);
    cur = prev.get(cur);
  }
  return {
    nodeIds,
    coords: nodeIds.map((id) => coordByNodeId.get(id)!),
    meters: distTo.get(goalId)!,
  };
}

/** Shortest path between two POIs (snapped to the road network). */
export function shortestPath(startPoiId: string, goalPoiId: string): RouteResult | null {
  const s = poiNode.get(startPoiId);
  const g = poiNode.get(goalPoiId);
  if (!s || !g) return null;
  return shortestPathByNodeId(s, g);
}

/** Snap an arbitrary coordinate to the nearest road node id (GPS, map pick). */
export function nearestNodeId(p: LatLng): string | undefined {
  let best: string | undefined;
  let bestD = Infinity;
  for (const [id, c] of coordByNodeId) {
    const d = haversine(p, c);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

/** Total length of the whole drawn path network (m). */
export function networkLengthMeters(): number {
  let total = 0;
  for (const road of campus.roads) {
    for (let i = 0; i < road.path.length - 1; i++) total += haversine(road.path[i], road.path[i + 1]);
  }
  return total;
}