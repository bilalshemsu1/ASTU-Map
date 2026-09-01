#!/usr/bin/env node
/**
 * to-campus.mjs — Convert a GeoJSON trace of ASTU into our campus.json schema.
 *
 * You trace buildings (Polygon), walking paths (LineString) and points
 * (Point) in geojson.io (or any GeoJSON editor), export as GeoJSON, then run
 * this script to project the lon/lat coordinates into our local meter space.
 *
 * USAGE
 *   node scripts/to-campus.mjs <trace.geojson> -o campus.json [options]
 *
 * CALIBRATION (mapping lon/lat -> local meters)
 *   Option 1 — equirectangular (default, north-aligned, no manual points):
 *     --ref "<lat>,<lon>"     a reference point (default: first feature)
 *   Option 2 — 2-point affine (accounts for rotation / any screenshot):
 *     --p1 "<lat>,<lon>" --m1 "<x>,<y>"     point 1 and its local meter coord
 *     --p2 "<lat>,<lon>" --m2 "<x>,<y>"     point 2 and its local meter coord
 *
 * PROPERTIES (read from each GeoJSON feature's properties)
 *   buildings (Polygon):  name, aliases (comma-sep), rooms (JSON or "alias=Room 1,Room 2")
 *   nodes (Point):        id(optional), name -> label, and kind from:
 *                         "entrance:<buildingId>" or "gate"/"junction"/"parking" via `type`
 *   edges (LineString):   auto-derived path nodes from each vertex
 *
 * Edge nodes are generated one per LineString vertex, with the edge chain
 * joined. Reuse the same vertex coordinate by drawing paths that share nodes.
 */

import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("-"));
const inputFile = positional[0];
const flag = (name) => {
  const l = args.indexOf("-" + name);
  const ll = args.indexOf("--" + name);
  const i = l >= 0 ? l : ll;
  return i >= 0 ? args[i + 1] : undefined;
};
let outFile = flag("o") ?? "campus.json";

if (!inputFile) {
  console.error("Usage: node scripts/to-campus.mjs <trace.geojson> -o campus.json [--ref lat,lon | --p1 lat,lon --m1 x,y --p2 lat,lon --m2 x,y]");
  process.exit(1);
}

// ---- parse calibration ----
let calib;
const p1 = flag("p1"), m1 = flag("m1"), p2 = flag("p2"), m2 = flag("m2");
if (p1 && m1 && p2 && m2) {
  calib = { kind: "affine", A: parseLL(p1), mA: parseVec(m1), B: parseLL(p2), mB: parseVec(m2) };
} else {
  calib = { kind: "equirect", ref: flag("ref") ? parseLL(flag("ref")) : null };
}

const geojson = JSON.parse(readFileSync(inputFile, "utf8"));
const features = geojson.type === "FeatureCollection" ? geojson.features : [geojson];

// derive reference if needed
if (calib.kind === "equirect" && !calib.ref) {
  calib.ref = firstCoord(features[0]);
}

const M_PER_DEG_LAT = 111320;
let affine = null;
if (calib.kind === "affine") {
  const { A, mA, B, mB } = calib;
  // vector in lat/lng space and in meter space
  const mLng = (B[1] - A[1]) * M_PER_DEG_LAT * Math.cos((A[0] * Math.PI) / 180);
  const mLat = (B[0] - A[0]) * M_PER_DEG_LAT;
  const mdx = mB[0] - mA[0];
  const mdy = mB[1] - mA[1];
  const geoLen = Math.hypot(mLat, mLng);
  const mLen = Math.hypot(mdx, mdy);
  const scale = mLen / geoLen;
  const geoAngle = Math.atan2(mLng, mLat); // direction in geo-space
  const mAngle = Math.atan2(mdy, mdx); // direction in meter-space
  const rot = mAngle - geoAngle;
  affine = { A, mA, rot, scale };
}

function project(ll) {
  const [lat, lon] = ll;
  if (affine) {
    const { A, mA, rot, scale } = affine;
    // local geo-meters from A
    const e = (lon - A[1]) * M_PER_DEG_LAT * Math.cos((A[0] * Math.PI) / 180);
    const n = (lat - A[0]) * M_PER_DEG_LAT;
    const cos = Math.cos(rot), sin = Math.sin(rot);
    const x = mA[0] + (e * cos - n * sin) * scale;
    const y = mA[1] + (e * sin + n * cos) * scale;
    return { x: round2(x), y: round2(y) };
  }
  // equirectangular, north-aligned
  const { ref } = calib;
  const x = (lon - ref[1]) * M_PER_DEG_LAT * Math.cos((ref[0] * Math.PI) / 180);
  const y = (lat - ref[0]) * M_PER_DEG_LAT;
  return { x: round2(x), y: round2(y) };
}

const buildings = [];
const nodes = [];
const edges = [];
let idSeq = 0;

for (const f of features) {
  const props = f.properties ?? {};
  const name = props.name || `Building ${buildings.length + 1}`;
  if (f.geometry.type === "Polygon") {
    const ring = f.geometry.coordinates[0];
    if (ring.length < 4) continue; // ignore degenerate
    const polygon = ring.slice(0, -1).map(project);
    buildings.push({
      id: props.id || slug(name),
      name,
      aliases: splitList(props.aliases),
      polygon,
      rooms: parseRooms(props.rooms),
      entrances: props.entrance
        ? [{ id: "ent-" + slug(name), nodeId: props.entrance, label: "Entrance" }]
        : [],
    });
  } else if (f.geometry.type === "LineString") {
    const pts = f.geometry.coordinates.map(project);
    // create a node per vertex, edge chain
    const nodeIds = pts.map((_, i) => "n-" + slug(name) + "-" + i);
    pts.forEach((p, i) =>
      nodes.push({ id: nodeIds[i], x: p.x, y: p.y, kind: props.type || "junction" }),
    );
    for (let i = 0; i < nodeIds.length - 1; i++) edges.push({ a: nodeIds[i], b: nodeIds[i + 1] });
  } else if (f.geometry.type === "Point") {
    const [x, y] = [project(f.geometry.coordinates).x, project(f.geometry.coordinates).y];
    nodes.push({ id: props.id || "n-" + (++idSeq), x, y, kind: props.type || "junction", label: props.name });
  }
}

const out = {
  scale: 1,
  buildings,
  nodes,
  edges,
};

// Normalize: shift so the minimum corner maps near (0,0). Keeps coordinates
// small and readable; distances are unaffected (they are metric differences).
const allPts = [
  ...buildings.flatMap((b) => b.polygon),
  ...nodes.map((n) => ({ x: n.x, y: n.y })),
];
if (allPts.length && flag("keep-absolute") !== "true") {
  const minX = Math.min(...allPts.map((p) => p.x));
  const minY = Math.min(...allPts.map((p) => p.y));
  const shift = (p) => ({ x: round2(p.x - minX), y: round2(p.y - minY) });
  for (const b of buildings) b.polygon = b.polygon.map(shift);
  for (const n of nodes) { const s = shift(n); n.x = s.x; n.y = s.y; }
}

// Associate entrance Points (type: "entrance:<buildingId>") with their building
for (const n of nodes) {
  const m = /^entrance:(\S+)$/.exec(n.kind || "");
  if (!m) continue;
  const bid = m[1];
  const b = buildings.find((x) => x.id === bid);
  if (b && !b.entrances.some((e) => e.nodeId === n.id)) {
    b.entrances.push({ id: "ent-" + n.id, nodeId: n.id, label: n.label || "Entrance" });
  }
}

// move entrance nodeIds targeting a node that may not exist yet -> resolved later
writeFileSync(outFile, JSON.stringify(out, null, 2) + "\n");
console.log(`Wrote ${outFile}: ${buildings.length} buildings, ${nodes.length} nodes, ${edges.length} edges.`);

// ---------- helpers ----------
function parseLL(s) {
  const [a, b] = s.split(",").map((v) => parseFloat(v));
  return [a, b];
}
function parseVec(s) {
  const [a, b] = s.split(",").map((v) => parseFloat(v));
  return [a, b];
}
function round2(v) {
  return Math.round(v * 100) / 100;
}
function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "b";
}
function splitList(v) {
  if (!v) return undefined;
  return String(v).split(",").map((s) => s.trim()).filter(Boolean);
}
function parseRooms(v) {
  if (!v) return undefined;
  if (typeof v === "string") {
    return v.split(",").map((s, i) => ({ id: "r-" + i, number: s.trim() })).filter((r) => r.number);
  }
  if (Array.isArray(v)) return v.map((s, i) => ({ id: "r-" + i, number: String(s) }));
  return undefined;
}
function firstCoord(f) {
  switch (f.geometry.type) {
    case "Point":
      return f.geometry.coordinates;
    case "LineString":
      return f.geometry.coordinates[0];
    case "Polygon":
      return f.geometry.coordinates[0][0];
  }
  return [0, 0];
}
