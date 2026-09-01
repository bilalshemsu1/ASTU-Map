// fetch-osm.mjs
// Fetches real road network + named buildings for ASTU from OpenStreetMap
// (Overpass API) and writes a normalized lib/campus.json used at runtime.
//
// Usage: node scripts/fetch-osm.mjs
//
// Output schema (campus.json):
// {
//   center: { lat, lon },
//   pois:   [{ id, name, kind, lat, lon, aliases:[], rooms:[{number,label}] }],
//   roads:  [{ id, tag, path:[{lat,lon}, ...] }]
// }

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "lib", "campus.json");

// Campus center and padded bounds (ASTU, Addis Ababa).
const CENTER = { lat: 8.8872, lon: 38.8096 };
// south, west, north, east
const BBOX = [8.8805, 38.8065, 8.8945, 38.817];

const ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function overpass(query) {
  const body = `data=${encodeURIComponent(query)}`;
  const lastErr = [];
  for (const ep of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(ep, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "ASTU-campnav/1.0 (build)" },
          body,
          signal: AbortSignal.timeout(60000),
        });
        if (res.status === 429 || res.status === 504 || res.status === 400) {
          lastErr.push(`${ep}: HTTP ${res.status}`);
          continue;
        }
        if (!res.ok) {
          lastErr.push(`${ep}: HTTP ${res.status}`);
          continue;
        }
        return await res.json();
      } catch (e) {
        lastErr.push(`${ep}: ${e.message}`);
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  }
  throw new Error("Overpass failed: " + lastErr.join(" | "));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Expand bbox slightly to pull surrounding access roads.
const [s, w, n, e] = BBOX;
const pad = 0.004;
const [S, W, N, E] = [s - pad, w - pad, n + pad, e + pad];

// --- 1. Roads ---
const roadQuery = `[out:json][timeout:40];way["highway"](${S},${W},${N},${E});out geom 900;`;
// --- 2. Named buildings / POIs ---
const poiQuery = `
[out:json][timeout:40];
(
  node["name"](${S},${W},${N},${E});
  node["building"](${S},${W},${N},${E});
  node["amenity"](${S},${W},${N},${E});
);
out tags geom 500;
`;

async function main() {
  console.log("Fetching roads from Overpass…");
  const roads = await overpass(roadQuery);
  console.log("  road ways:", roads.elements?.length ?? 0);

  await sleep(2000);
  console.log("Fetching buildings/POIs…");
  const pois = await overpass(poiQuery);
  console.log("  poi elements:", pois.elements?.length ?? 0);

  const roadsOut = (roads.elements ?? [])
    .filter((el) => el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 1)
    .map((el) => ({
      id: "osm-" + el.id,
      tag: typeof el.tags?.highway === "string" ? el.tags.highway : "path",
      path: el.geometry.map((g) => ({ lat: gt(g.lat), lon: gt(g.lon) })),
    }));

  const JUNK = /^bench$/i;
  const JUNK_NAME = /^(name:?en|name)$/i;
  const seen = new Set();
  const poisOut = [];
  for (const el of pois.elements ?? []) {
    const lat = el.type === "node" ? el.lat : el.center?.lat;
    const lon = el.type === "node" ? el.lon : el.center?.lon;
    const name = typeof el.tags?.name === "string" && el.tags.name.trim() ? el.tags.name.trim() : "";
    const realName =
      name && !name.includes("name:") && !/^\d+$/.test(name) && !/^[-a-z\d]+$/.test(name)
        ? name
        : "";
    const amenity = typeof el.tags?.amenity === "string" ? el.tags.amenity : "";
    const building = typeof el.tags?.building === "string" ? el.tags.building : "";
    if (typeof lat !== "number" || typeof lon !== "number") continue;
    if (JUNK_NAME.test(realName)) continue;

    // Drop junk that isn't a navigable destination.
    if (JUNK.test(realName || amenity || building)) continue;
    if (!realName && !amenity && !building) continue;

    // Keep only the campus core so search isn't polluted by distant suburbs.
    // (rough 900m box centered on ASTU)
    if (Math.abs(lat - CENTER.lat) * 111000 > 900) continue;
    if (Math.abs(lon - CENTER.lon) * 111000 > 900) continue;

    // Prefer named entries; also keep amenities/buildings even if unnamed.
    const label = stripJunkNames(clean(realName || niceLabel(amenity || building, el.tags)));
    if (JUNK_NAME.test(label) || !label) continue;
    const key = `${gt(lat)},${gt(lon)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const roomCount = roomCountFor(label);
    poisOut.push({
      id: "osm-" + el.id,
      name: label,
      kind: building ? "building" : amenity ? "poi" : "place",
      lat: gt(lat),
      lon: gt(lon),
      aliases: [],
      rooms: makeRooms(label, roomCount),
    });
  }

  const campus = {
    center: CENTER,
    meta: {
      generated: new Date().toISOString(),
      source: "OpenStreetMap via Overpass",
    },
    pois: orderPois(poisOut),
    roads: roadsOut,
  };

  writeFileSync(OUT, JSON.stringify(campus, null, 2), "utf8");
  console.log("Wrote", OUT);
  console.log("  pois:", campus.pois.length, "roads:", campus.roads.length);
}

// round to ~1e-6 deg (≈0.1 m) to merge near-identical coordinates
function gt(v) {
  return Math.round(v * 1e6) / 1e6;
}

function clean(s) {
  let out = String(s).replace(/\s*\(.*?\)/g, "").trim();
  out = out.replace(/\s+/g, " ");
  out = out
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
  return out || s;
}

function stripJunkNames(s) {
  return s.replace(/\bname:?en\b/gi, "").replace(/\bname\b/gi, "").trim();
}

function niceLabel(fallback, tags) {
  const withName = Object.entries(tags || {}).find(([k, v]) => /name/i.test(k) && v)?.join(" ")?.split(" ")[0];
  const types = [tags?.amenity, tags?.building, tags?.shop, tags?.leisure, tags?.landuse].filter(Boolean);
  const t = withName || types[0] || fallback || "Campus point";
  return t;
}

function roomCountFor(label) {
  // Big named buildings get a few rooms; landmarks get fewer.
  if (/BLOCK|LIBRARY|HALL|ENGINEER|SCIENCE|FRESH|CAFE|DORM/i.test(label)) return 8;
  return 4;
}

function makeRooms(label, count) {
  const rooms = [];
  for (let i = 0; i < count; i++) rooms.push({ number: `${(101 + i)}`, label: `Room ${101 + i}` });
  return rooms;
}

// Put ASTU-keyword buildings first, then by name; keeps search order sane.
function orderPois(pois) {
  const kw = /AASTU|ASTU|BUILDING|GRADUATION|LIBRARY|ADMIN|REGISTRAR|CLINIC|FRESH|STUDENT/i;
  return [...pois].sort((a, b) => {
    const aa = kw.test(a.name) ? 0 : 1;
    const bb = kw.test(b.name) ? 0 : 1;
    if (aa !== bb) return aa - bb;
    return a.name.localeCompare(b.name);
  });
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});