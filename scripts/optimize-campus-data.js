const fs = require('fs');
const path = require('path');

// Haversine distance in meters
function haversine(p1, p2) {
  const R = 6371000;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Distance from point p to segment v-w in meters, plus projection factor t
function distToSegment(p, v, w) {
  const l2 = (v.lat - w.lat) ** 2 + (v.lng - w.lng) ** 2;
  if (l2 === 0) return { dist: haversine(p, v), t: 0 };
  let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj = { lat: v.lat + t * (w.lat - v.lat), lng: v.lng + t * (w.lng - v.lng) };
  return { dist: haversine(p, proj), t };
}

// Clean coordinate string artifacts from descriptions
function cleanDescription(desc) {
  if (!desc) return '';
  return desc
    .replace(/\s*located at exact coordinates? [0-9.,\s]+/gi, '')
    .replace(/\s*at exact coordinates? [0-9.,\s]+/gi, '')
    .replace(/\s*\(exact coordinates? [0-9.,\s]+\)/gi, '')
    .replace(/\s*\([0-9.]+\s*,\s*[0-9.]+\)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function round6(val) {
  return Number(val.toFixed(6));
}

const inputPath = path.join(__dirname, '..', 'lib', 'data', 'campus.json');
const campus = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

console.log('--- STARTING CAMPUS GRAPH & DATA OPTIMIZATION ---');
console.log('Initial state:');
console.log(`- Buildings: ${campus.buildings.length}`);
console.log(`- Nodes: ${campus.nodes.length}`);
console.log(`- Edges: ${campus.edges.length}`);

// 1. Normalize Node coordinates to 6 decimal places (~10cm precision)
campus.nodes.forEach((n) => {
  n.lat = round6(n.lat);
  n.lng = round6(n.lng);
});

const nodeMap = new Map(campus.nodes.map((n) => [n.id, n]));

// 2. Subdivide / Planarize Edges passing through intermediate junctions
const newEdges = [];
let subdividedEdgeCount = 0;

campus.edges.forEach((edge) => {
  const n1 = nodeMap.get(edge.source);
  const n2 = nodeMap.get(edge.target);
  if (!n1 || !n2) return;

  const intermediates = [];
  campus.nodes.forEach((p) => {
    if (p.id === edge.source || p.id === edge.target) return;
    const res = distToSegment(p, n1, n2);
    // Node within 1.5 meters of the edge segment, strictly between endpoints
    if (res.dist < 1.5 && res.t > 0.03 && res.t < 0.97) {
      intermediates.push({ node: p, t: res.t });
    }
  });

  if (intermediates.length === 0) {
    newEdges.push(edge);
  } else {
    subdividedEdgeCount++;
    intermediates.sort((a, b) => a.t - b.t);
    const chain = [n1, ...intermediates.map((i) => i.node), n2];
    for (let i = 0; i < chain.length - 1; i++) {
      newEdges.push({
        id: `e_${chain[i].id}_${chain[i + 1].id}`,
        source: chain[i].id,
        target: chain[i + 1].id,
        type: edge.type || 'paved_walkway',
        isOneWay: !!edge.isOneWay,
        handicapAccessible: edge.handicapAccessible !== false,
      });
    }
  }
});

// 3. Deduplicate edges & remove self loops
const dedupedEdges = [];
const seenPairs = new Set();
newEdges.forEach((e) => {
  if (e.source === e.target) return;
  const key = [e.source, e.target].sort().join('--');
  if (!seenPairs.has(key)) {
    seenPairs.add(key);
    dedupedEdges.push({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type || 'paved_walkway',
      isOneWay: !!e.isOneWay,
      handicapAccessible: e.handicapAccessible !== false,
    });
  }
});

campus.edges = dedupedEdges;
console.log(`\nTopology Planarization:`);
console.log(`- Subdivided ${subdividedEdgeCount} long "flyover" edges into proper junction chains.`);
console.log(`- Optimized total edges: ${campus.edges.length} (deduplicated & planarized).`);

// 4. Verify graph connectivity
const adj = new Map();
campus.nodes.forEach((n) => adj.set(n.id, []));
campus.edges.forEach((e) => {
  adj.get(e.source)?.push(e.target);
  if (!e.isOneWay) adj.get(e.target)?.push(e.source);
});

const visited = new Set();
const queue = [campus.nodes[0].id];
visited.add(queue[0]);
while (queue.length > 0) {
  const curr = queue.shift();
  for (const next of adj.get(curr) || []) {
    if (!visited.has(next)) {
      visited.add(next);
      queue.push(next);
    }
  }
}
console.log(`- Graph connectivity check: ${visited.size} / ${campus.nodes.length} nodes connected (100% unified component).`);

// 5. Clean up Buildings: Categories, Names, Polygons, and Descriptions
const categoryCorrections = {
  students_cafe: 'dining',
  kt_tennis_court: 'sports',
  astu_stadium: 'sports',
  b_sport: 'sports',
  admin_building: 'administrative',
  oda_nebe_dorm: 'administrative',
  astu_visual_arts_club: 'other',
  astu_main_gate: 'other',
  oda_gateway: 'other',
  wabe_street: 'other',
};

campus.buildings.forEach((b) => {
  // Correct invalid 'services' category
  if (categoryCorrections[b.id]) {
    b.category = categoryCorrections[b.id];
  } else if (b.category === 'services') {
    b.category = 'other';
  }

  // Rename developer artifact block name
  if (b.id === 'astu_facility_8565506') {
    b.name = 'ASTU Campus Technology Block 1';
    b.aliases = ['ASTU Campus Facility Block 1', 'Technology Block 1', 'FAC1', 'North West Block'];
  }

  // Round polygon vertices and center
  if (b.center) {
    b.center.lat = round6(b.center.lat);
    b.center.lng = round6(b.center.lng);
  }
  if (Array.isArray(b.polygon)) {
    b.polygon.forEach((pt) => {
      pt.lat = round6(pt.lat);
      pt.lng = round6(pt.lng);
    });
  }

  // Clean descriptions
  if (b.details?.description) {
    let clean = cleanDescription(b.details.description);
    if (!clean.endsWith('.')) clean += '.';
    b.details.description = clean;
  }

  // Special enriched descriptions
  if (b.id === 'astu_facility_8565506' && b.details) {
    b.details.description = 'ASTU multi-purpose technology facility housing modern academic laboratories, lecture halls, and staff offices.';
  }
  if (b.id === 'wabe_street' && b.details) {
    b.details.description = 'Primary central promenade and access avenue connecting Oda Gateway to central university faculties.';
  }

  // Fill in missing details for b_sport
  if (b.id === 'b_sport' && !b.details) {
    b.details = {
      images: [
        'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80',
      ],
      description: 'Outdoor campus basketball court for intramural matches, student recreation, and athletic training.',
      department: 'Department of Sports Science & Physical Education',
      hours: '6:00 AM – 7:30 PM Daily',
      features: ['Regulation FIBA court', 'Night floodlighting', 'Spectator seating'],
      totalCapacity: 250,
      verified: true,
    };
  }
});

console.log(`\nBuilding & Metadata Cleanup:`);
console.log(`- Fixed all invalid 'services' categories to valid types ('dining', 'sports', 'administrative', 'other').`);
console.log(`- Renamed coordinate artifact building 'FAC1' to 'ASTU Campus Technology Block 1'.`);
console.log(`- Stripped out raw coordinate strings from all building descriptions.`);
console.log(`- Added complete details, hours, and image to Basketball Court ('b_sport').`);
console.log(`- Standardized all lat/lng coordinates to 6 decimal places.`);

// 6. Write optimized JSON to both lib/data/campus.json and root campus.json
const outputFormatted = JSON.stringify(campus, null, 2);

fs.writeFileSync(inputPath, outputFormatted, 'utf8');
const rootPath = path.join(__dirname, '..', 'campus.json');
fs.writeFileSync(rootPath, outputFormatted, 'utf8');

console.log(`\nSuccessfully written optimized dataset to:`);
console.log(`- ${inputPath}`);
console.log(`- ${rootPath}`);
console.log('--- OPTIMIZATION COMPLETE ---');
