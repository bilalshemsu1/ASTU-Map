import campusJson from "./campus.json";
import type { CampusData, LatLng, Poi } from "./types";

export const campus: CampusData = (campusJson as unknown) as CampusData;

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
  return `${p.lat.toFixed(6)},${p.lon.toFixed(6)}`;
}

export type AdjacencyGraph = {
  adj: Map<string, { to: string; dist: number }[]>;
  nodeToCoords: Map<string, LatLng>;
};

/** Build an undirected graph from all OSM roads. */
export function buildGraph(roads: CampusData["roads"]): AdjacencyGraph {
  const adj = new Map<string, { to: string; dist: number }[]>();
  const nodeToCoords = new Map<string, LatLng>();

  function addNode(p: LatLng): string {
    const k = keyOf(p);
    if (!nodeToCoords.has(k)) nodeToCoords.set(k, p);
    if (!adj.has(k)) adj.set(k, []);
    return k;
  }

  for (const road of roads) {
    for (let i = 0; i < road.path.length - 1; i++) {
      const u = addNode(road.path[i]);
      const v = addNode(road.path[i + 1]);
      const dist = haversine(road.path[i], road.path[i + 1]);
      adj.get(u)!.push({ to: v, dist });
      adj.get(v)!.push({ to: u, dist });
    }
  }

  return { adj, nodeToCoords };
}

export function findNearestNode(
  point: LatLng,
  nodeToCoords: Map<string, LatLng>
): { key: string; dist: number } {
  let bestKey = "";
  let minD = Infinity;

  for (const [key, coords] of nodeToCoords) {
    const d = haversine(point, coords);
    if (d < minD) {
      minD = d;
      bestKey = key;
    }
  }
  return { key: bestKey, dist: minD };
}

export type ShortestPathResult = {
  path: LatLng[];
  distMeters: number;
};

export function shortestPath(
  start: LatLng,
  end: LatLng,
  graph: AdjacencyGraph
): ShortestPathResult | null {
  if (graph.nodeToCoords.size === 0) return null;

  const startNode = findNearestNode(start, graph.nodeToCoords).key;
  const endNode = findNearestNode(end, graph.nodeToCoords).key;

  if (!startNode || !endNode) return null;

  const dist = new Map<string, number>();
  const prev = new Map<string, string>();
  const unvisited = new Set<string>(graph.adj.keys());

  for (const k of unvisited) dist.set(k, Infinity);
  dist.set(startNode, 0);

  while (unvisited.size > 0) {
    let u: string | null = null;
    let minD = Infinity;
    for (const node of unvisited) {
      const d = dist.get(node) ?? Infinity;
      if (d < minD) {
        minD = d;
        u = node;
      }
    }

    if (!u || minD === Infinity) break;
    if (u === endNode) break;

    unvisited.delete(u);

    const neighbors = graph.adj.get(u) || [];
    for (const edge of neighbors) {
      if (!unvisited.has(edge.to)) continue;
      const alt = dist.get(u)! + edge.dist;
      if (alt < (dist.get(edge.to) ?? Infinity)) {
        dist.set(edge.to, alt);
        prev.set(edge.to, u);
      }
    }
  }

  if (dist.get(endNode) === Infinity) return null;

  const pathKeys: string[] = [];
  let curr: string | undefined = endNode;
  while (curr) {
    pathKeys.push(curr);
    curr = prev.get(curr);
  }
  pathKeys.reverse();

  const pathCoords = pathKeys.map((k) => graph.nodeToCoords.get(k)!);

  return {
    path: pathCoords,
    distMeters: Math.round(dist.get(endNode)!),
  };
}