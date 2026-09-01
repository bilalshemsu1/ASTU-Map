import { PathNode, PathEdge, RouteResult, RouteStep, CampusData, LatLng } from '../types/map';

// Haversine distance formula in meters
export function calculateHaversineDistance(p1: LatLng, p2: LatLng): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function findShortestPath(
  startNodeId: string,
  targetNodeId: string,
  campusData: CampusData
): RouteResult | null {
  const { nodes, edges } = campusData;

  const nodeMap = new Map<string, PathNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  if (!nodeMap.has(startNodeId) || !nodeMap.has(targetNodeId)) {
    return null;
  }

  // Build adjacency list
  const adj = new Map<string, Array<{ neighborId: string; weight: number; edgeId: string }>>();
  nodes.forEach((n) => adj.set(n.id, []));

  edges.forEach((edge) => {
    const n1 = nodeMap.get(edge.source);
    const n2 = nodeMap.get(edge.target);
    if (!n1 || !n2) return;

    const w = edge.weight ?? calculateHaversineDistance(n1, n2);
    adj.get(edge.source)?.push({ neighborId: edge.target, weight: w, edgeId: edge.id });
    adj.get(edge.target)?.push({ neighborId: edge.source, weight: w, edgeId: edge.id });
  });

  const distances = new Map<string, number>();
  const previous = new Map<string, { nodeId: string; edgeId: string } | null>();
  const unvisited = new Set<string>();

  nodes.forEach((node) => {
    distances.set(node.id, Infinity);
    previous.set(node.id, null);
    unvisited.add(node.id);
  });

  distances.set(startNodeId, 0);

  while (unvisited.size > 0) {
    let currentId: string | null = null;
    let minDistance = Infinity;

    for (const nodeId of unvisited) {
      const dist = distances.get(nodeId) ?? Infinity;
      if (dist < minDistance) {
        minDistance = dist;
        currentId = nodeId;
      }
    }

    if (currentId === null || minDistance === Infinity) break;
    if (currentId === targetNodeId) break;

    unvisited.delete(currentId);

    const neighbors = adj.get(currentId) || [];
    for (const { neighborId, weight } of neighbors) {
      if (!unvisited.has(neighborId)) continue;
      const alt = distances.get(currentId)! + weight;
      if (alt < distances.get(neighborId)!) {
        distances.set(neighborId, alt);
        previous.set(neighborId, { nodeId: currentId, edgeId: '' });
      }
    }
  }

  if (distances.get(targetNodeId) === Infinity) {
    return null;
  }

  // Reconstruct path
  const path: PathNode[] = [];
  let curr: string | null = targetNodeId;
  while (curr) {
    const node = nodeMap.get(curr);
    if (node) path.unshift(node);
    const prevInfo = previous.get(curr);
    curr = prevInfo ? prevInfo.nodeId : null;
  }

  const totalDistanceMeters = Math.round(distances.get(targetNodeId) || 0);
  const estimatedTimeMinutes = Math.max(1, Math.ceil(totalDistanceMeters / 80));

  // Generate step-by-step instructions
  const steps: RouteStep[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to = path[i + 1];
    const stepDist = Math.round(calculateHaversineDistance(from, to));

    let direction = 'Walk straight';
    if (i > 0) {
      const prev = path[i - 1];
      const bearingPrev = Math.atan2(from.lat - prev.lat, from.lng - prev.lng);
      const bearingNext = Math.atan2(to.lat - from.lat, to.lng - from.lng);
      let diff = (bearingNext - bearingPrev) * (180 / Math.PI);
      diff = ((diff + 360 + 180) % 360) - 180;

      if (diff > 45 && diff < 135) direction = 'Turn right';
      else if (diff >= 135) direction = 'Make a sharp turn right';
      else if (diff < -45 && diff > -135) direction = 'Turn left';
      else if (diff <= -135) direction = 'Make a sharp turn left';
      else direction = 'Continue straight';
    }

    const landmarkText = to.label ? ` towards ${to.label}` : '';
    steps.push({
      instruction: `${direction}${landmarkText}`,
      distanceMeters: stepDist,
      fromNode: from,
      toNode: to,
    });
  }

  return {
    path,
    totalDistanceMeters,
    estimatedTimeMinutes,
    steps,
  };
}
