import { PathNode, RouteResult, RouteStep, LatLng, CampusData } from '../types/map';
import { calculateHaversineDistance, findShortestPath } from './graph';

export async function fetchRealWalkingRoute(
  start: LatLng,
  target: LatLng,
  startNodeId: string,
  targetNodeId: string,
  campusData: CampusData
): Promise<RouteResult> {
  // Helper to find closest node to a lat/lng coordinate
  const findClosestNode = (coord: LatLng, filterRoadOnly = false) => {
    let closestNode = campusData.nodes[0];
    let minDist = Infinity;
    campusData.nodes.forEach((n) => {
      if (filterRoadOnly && !n.id.startsWith('r_')) return;
      const d = calculateHaversineDistance(coord, n);
      if (d < minDist) {
        minDist = d;
        closestNode = n;
      }
    });
    return closestNode;
  };

  // Determine starting node: use explicit node if exists, or snap to nearest node in dataset
  let actualStartNode = campusData.nodes.find((n) => n.id === startNodeId) || findClosestNode(start);
  let actualTargetNode = campusData.nodes.find((n) => n.id === targetNodeId) || findClosestNode(target);

  // 1. Primary ASTU Internal Campus Graph Route
  let localResult = findShortestPath(actualStartNode.id, actualTargetNode.id, campusData);

  // 2. If direct entrance node routing is unlinked, snap to nearest connected road nodes (r_)
  if (!localResult || localResult.path.length === 0) {
    const startRoadNode = findClosestNode(start, true);
    const targetRoadNode = findClosestNode(target, true);
    localResult = findShortestPath(startRoadNode.id, targetRoadNode.id, campusData);
  }

  // 3. Fallback: If path is still null or unnaturally indirect (> 2.8x straight-line distance), optimize with direct walkway
  const directDist = Math.round(calculateHaversineDistance(start, target));
  if (!localResult || localResult.path.length === 0 || (directDist > 30 && localResult.totalDistanceMeters > directDist * 2.8)) {
    const startRoadNode = findClosestNode(start, true);
    const targetRoadNode = findClosestNode(target, true);

    const midwayPath = [
      { id: 'user_start', lat: start.lat, lng: start.lng },
      startRoadNode,
      targetRoadNode,
      { id: 'user_target', lat: target.lat, lng: target.lng },
    ].filter((v, i, a) => i === 0 || v.id !== a[i - 1].id);

    return {
      path: midwayPath,
      totalDistanceMeters: directDist,
      estimatedTimeMinutes: Math.max(1, Math.ceil(directDist / 80)),
      steps: [
        {
          instruction: `Head straight along campus courtyard towards destination`,
          distanceMeters: directDist,
          fromNode: midwayPath[0],
          toNode: midwayPath[midwayPath.length - 1],
        },
      ],
    };
  }
  if (localResult && localResult.path.length > 0) {
    // Prepend exact user start point if far from node
    const startNode = localResult.path[0];
    const distToStartNode = calculateHaversineDistance(start, startNode);
    if (distToStartNode > 15) {
      localResult.path.unshift({ id: 'user_start', lat: start.lat, lng: start.lng });
      localResult.totalDistanceMeters += Math.round(distToStartNode);
      localResult.steps.unshift({
        instruction: `Walk towards ${startNode.label || 'campus walkway'}`,
        distanceMeters: Math.round(distToStartNode),
        fromNode: { id: 'user_start', lat: start.lat, lng: start.lng },
        toNode: startNode,
      });
    }

    // Append exact target point if far from entrance node
    const targetNode = localResult.path[localResult.path.length - 1];
    const distToTargetNode = calculateHaversineDistance(target, targetNode);
    if (distToTargetNode > 15) {
      localResult.path.push({ id: 'user_target', lat: target.lat, lng: target.lng });
      localResult.totalDistanceMeters += Math.round(distToTargetNode);
      localResult.steps.push({
        instruction: 'Arrive at destination building entrance',
        distanceMeters: Math.round(distToTargetNode),
        fromNode: targetNode,
        toNode: { id: 'user_target', lat: target.lat, lng: target.lng },
      });
    }

    localResult.estimatedTimeMinutes = Math.max(1, Math.ceil(localResult.totalDistanceMeters / 80));
    return localResult;
  }

  // 4. Direct Fallback Route if Graph Search is Unconnected
  return {
    path: [
      { id: 'start', lat: start.lat, lng: start.lng },
      { id: 'target', lat: target.lat, lng: target.lng },
    ],
    totalDistanceMeters: directDist,
    estimatedTimeMinutes: Math.max(1, Math.ceil(directDist / 80)),
    steps: [
      {
        instruction: 'Walk directly along campus path to destination',
        distanceMeters: directDist,
        fromNode: { id: 'start', lat: start.lat, lng: start.lng },
        toNode: { id: 'target', lat: target.lat, lng: target.lng },
      },
    ],
  };
}
