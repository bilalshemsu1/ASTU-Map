import { PathNode, RouteResult, RouteStep, LatLng, CampusData } from '../types/map';
import { calculateHaversineDistance, findShortestPath } from './graph';

export async function fetchRealWalkingRoute(
  start: LatLng,
  target: LatLng,
  startNodeId: string,
  targetNodeId: string,
  campusData: CampusData
): Promise<RouteResult> {
  // Helper to find closest node to a given coordinate
  const findClosestNode = (coord: LatLng, filterRoadOnly = false): PathNode => {
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

  // Determine starting graph node: use explicit node if valid, or snap to nearest connected road/walkway node
  let actualStartNode =
    (startNodeId && campusData.nodes.find((n) => n.id === startNodeId)) ||
    findClosestNode(start, true);

  // Determine target graph node: use explicit building entrance node if valid, or snap to nearest road node
  let actualTargetNode =
    (targetNodeId && campusData.nodes.find((n) => n.id === targetNodeId)) ||
    findClosestNode(target, false);

  // 1. Primary ASTU Internal Campus Graph Route via Dijkstra
  let localResult = findShortestPath(actualStartNode.id, actualTargetNode.id, campusData);

  // 2. If entrance nodes were disconnected, snap both to the nearest road network nodes (r_*)
  if (!localResult || localResult.path.length === 0) {
    const startRoadNode = findClosestNode(start, true);
    const targetRoadNode = findClosestNode(target, true);
    actualStartNode = startRoadNode;
    actualTargetNode = targetRoadNode;
    localResult = findShortestPath(startRoadNode.id, targetRoadNode.id, campusData);
  }

  // 3. Connect User Start & Target to the Road Network
  if (localResult && localResult.path.length > 0) {
    const startRoadNode = localResult.path[0];
    const distToStartRoad = calculateHaversineDistance(start, startRoadNode);

    // Prepend user origin point if separated from the first road node (> 6m)
    if (distToStartRoad > 6) {
      localResult.path.unshift({
        id: 'user_start',
        lat: start.lat,
        lng: start.lng,
        label: 'Start Position',
      });
      localResult.totalDistanceMeters += Math.round(distToStartRoad);
      localResult.steps.unshift({
        instruction: `Walk ${Math.round(distToStartRoad)}m to join campus path (${startRoadNode.label || 'campus walkway'})`,
        distanceMeters: Math.round(distToStartRoad),
        fromNode: { id: 'user_start', lat: start.lat, lng: start.lng },
        toNode: startRoadNode,
      });
    }

    // Append target destination point if separated from the last road/entrance node (> 6m)
    const endRoadNode = localResult.path[localResult.path.length - 1];
    const distToEndRoad = calculateHaversineDistance(target, endRoadNode);

    if (distToEndRoad > 6) {
      const targetBuilding = campusData.buildings.find(
        (b) => b.entranceNodeId === targetNodeId || b.id === targetNodeId
      );
      const destLabel = targetBuilding?.name || endRoadNode.label || 'destination';

      localResult.path.push({
        id: 'user_target',
        lat: target.lat,
        lng: target.lng,
        label: destLabel,
      });
      localResult.totalDistanceMeters += Math.round(distToEndRoad);
      localResult.steps.push({
        instruction: `Arrive at ${destLabel}`,
        distanceMeters: Math.round(distToEndRoad),
        fromNode: endRoadNode,
        toNode: { id: 'user_target', lat: target.lat, lng: target.lng },
      });
    }

    localResult.estimatedTimeMinutes = Math.max(1, Math.ceil(localResult.totalDistanceMeters / 80));
    return localResult;
  }

  // 4. Fallback: Always snap to the nearest road network rather than cutting a straight line across campus
  const snapStart = findClosestNode(start, true);
  const snapTarget = findClosestNode(target, true);
  const roadSegmentDist = Math.round(calculateHaversineDistance(snapStart, snapTarget));
  const distStartToRoad = Math.round(calculateHaversineDistance(start, snapStart));
  const distRoadToTarget = Math.round(calculateHaversineDistance(snapTarget, target));
  const totalMeters = distStartToRoad + roadSegmentDist + distRoadToTarget;

  const connectedRoadPath: PathNode[] = [
    { id: 'user_start', lat: start.lat, lng: start.lng, label: 'Start Point' },
    snapStart,
    snapTarget,
    { id: 'user_target', lat: target.lat, lng: target.lng, label: 'Destination' },
  ].filter((v, i, a) => i === 0 || v.id !== a[i - 1].id);

  const fallbackSteps: RouteStep[] = [
    {
      instruction: `Walk ${distStartToRoad}m to nearest road (${snapStart.label || 'campus walkway'})`,
      distanceMeters: distStartToRoad,
      fromNode: connectedRoadPath[0],
      toNode: snapStart,
    },
    {
      instruction: `Follow campus road network towards ${snapTarget.label || 'destination area'}`,
      distanceMeters: roadSegmentDist,
      fromNode: snapStart,
      toNode: snapTarget,
    },
    {
      instruction: `Arrive at destination`,
      distanceMeters: distRoadToTarget,
      fromNode: snapTarget,
      toNode: connectedRoadPath[connectedRoadPath.length - 1],
    },
  ];

  return {
    path: connectedRoadPath,
    totalDistanceMeters: totalMeters,
    estimatedTimeMinutes: Math.max(1, Math.ceil(totalMeters / 80)),
    steps: fallbackSteps,
  };
}
