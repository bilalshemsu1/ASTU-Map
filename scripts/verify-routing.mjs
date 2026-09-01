// Quick sanity check: replicate the graph routing and print real distances.
import { readFileSync } from "node:fs";

const campus = JSON.parse(readFileSync("lib/campus.json", "utf8"));

const R = 6371008.8;
const haversine = (a, b) => {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};

const keyOf = (p) => `${Math.round(p.lat * 1e6)},${Math.round(p.lon * 1e6)}`;
const nodeIdByCoord = new Map();
const coordByNodeId = new Map();
const adjacency = new Map();

const nodeIdFor = (p) => {
  const k = keyOf(p);
  let id = nodeIdByCoord.get(k);
  if (!id) {
    id = k;
    nodeIdByCoord.set(k, id);
    coordByNodeId.set(id, { lat: p.lat, lon: p.lon });
    adjacency.set(id, new Map());
  }
  return id;
};
const addEdge = (a, b) => {
  const A = nodeIdFor(a);
  const B = nodeIdFor(b);
  if (A === B) return;
  const m = haversine(a, b);
  adjacency.get(A).set(B, m);
  adjacency.get(B).set(A, m);
};

for (const road of campus.roads) {
  for (let i = 0; i < road.path.length - 1; i++) addEdge(road.path[i], road.path[i + 1]);
}

const poiNode = new Map();
for (const poi of campus.pois) {
  let best = null, bestD = Infinity;
  for (const [id, c] of coordByNodeId) {
    const d = haversine(poi, c);
    if (d < bestD) { bestD = d; best = id; }
  }
  if (best) poiNode.set(poi.id, best);
}

function dijkstra(s, g) {
  const prev = new Map();
  const dist = new Map([[s, 0]]);
  const visited = new Set();
  const queue = new Set([s]);
  while (queue.size) {
    let cur = "", best = Infinity;
    for (const id of queue) { const d = dist.get(id) ?? Infinity; if (d < best) { best = d; cur = id; } }
    if (!cur || best === Infinity) break;
    queue.delete(cur);
    if (cur === g) break;
    visited.add(cur);
    for (const [n, w] of adjacency.get(cur) ?? []) {
      if (visited.has(n)) continue;
      const alt = (dist.get(cur) ?? Infinity) + w;
      if (alt < (dist.get(n) ?? Infinity)) { dist.set(n, alt); prev.set(n, cur); queue.add(n); }
    }
  }
  if (!dist.has(g)) return null;
  const ids = [];
  let c = g;
  while (c !== undefined) { ids.unshift(c); c = prev.get(c); }
  return { meters: dist.get(g), steps: ids.length };
}

const byName = (q) => campus.pois.find((p) => p.name.toLowerCase().includes(q));
const pairs = [
  ["graduation", "library"],
  ["graduation", "student cafe"],
  ["registrar", "freshman1"],
  ["clinic", "sewsabi"],
  ["astu", "clinic"],
];
let ok = true;
for (const [a, b] of pairs) {
  const A = byName(a), B = byName(b);
  if (!A || !B) { console.log(`MISSING poi for pair ${a}->${b}`); ok = false; continue; }
  const sa = poiNode.get(A.id), sb = poiNode.get(B.id);
  if (!sa || !sb) { console.log(`NO SNAP ${a}->${b}`); ok = false; continue; }
  const r = dijkstra(sa, sb);
  if (!r) { console.log(`UNREACHABLE ${a}->${b}`); ok = false; continue; }
  console.log(`${a} -> ${b}: ${r.meters.toFixed(1)} m over ${r.steps} nodes`);
}
console.log("roads:", campus.roads.length, "pois:", campus.pois.length);
process.exit(ok ? 0 : 1);