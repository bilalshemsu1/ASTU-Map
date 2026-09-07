import { PathNode, RouteResult, RouteStep, LatLng, CampusData } from '../types/map';
import { calculateHaversineDistance, findShortestPath } from './graph';

export async function fetchRealWalkingRoute(
  start: LatLng,
  target: LatLng,
  startNodeId: string,
  targetNodeId: string,
  campusData: CampusData
): Promise<RouteResult> {
  // Only snap start/target to nearest node if an explicit node ID was not provided or invalid
  let actualStartNodeId = startNodeId;
  const startExists = campusData.nodes.some((n) => n.id === startNodeId);
  if (!startExists) {
    let minStartDist = Infinity;
    campusData.nodes.forEach((n) => {
      const d = calculateHaversineDistance(start, n);
      if (d < minStartDist) {
        minStartDist = d;
        actualStartNodeId = n.id;
      }
    });
  }

  let actualTargetNodeId = targetNodeId;
  const targetExists = campusData.nodes.some((n) => n.id === targetNodeId);
  if (!targetExists) {
    let minTargetDist = Infinity;
    campusData.nodes.forEach((n) => {
      const d = calculateHaversineDistance(target, n);
      if (d < minTargetDist) {
        minTargetDist = d;
        actualTargetNodeId = n.id;
      }
    });
  }

  // 1. Primary ASTU Internal Campus Graph Route (Accurate Foot Paths)
  let localResult = findShortestPath(actualStartNodeId, actualTargetNodeId, campusData);

  // If path finding failed using entrance node IDs (e.g. unlinked entrance node), snap to nearest road nodes
  if (!localResult || localResult.path.length === 0) {
    let nearestStartRoadId = actualStartNodeId;
    let minStartD = Infinity;
    let nearestTargetRoadId = actualTargetNodeId;
    let minTargetD = Infinity;

    campusData.nodes.forEach((n) => {
      if (n.id.startsWith('r_')) {
        const dS = calculateHaversineDistance(start, n);
        if (dS < minStartD) {
          minStartD = dS;
          nearestStartRoadId = n.id;
        }
        const dT = calculateHaversineDistance(target, n);
        if (dT < minTargetD) {
          minTargetD = dT;
          nearestTargetRoadId = n.id;
        }
      }
    });

    localResult = findShortestPath(nearestStartRoadId, nearestTargetRoadId, campusData);
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

  // 2. Direct Fallback Route if Graph Search is Unconnected
  const directDist = Math.round(calculateHaversineDistance(start, target));
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
