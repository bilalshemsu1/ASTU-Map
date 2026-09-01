import { PathNode, RouteResult, RouteStep, LatLng, CampusData } from '../types/map';
import { calculateHaversineDistance, findShortestPath } from './graph';

export async function fetchRealWalkingRoute(
  start: LatLng,
  target: LatLng,
  startNodeId: string,
  targetNodeId: string,
  campusData: CampusData
): Promise<RouteResult> {
  try {
    // Call OSRM Real Foot Routing API
    const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${start.lng},${start.lat};${target.lng},${target.lat}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(osrmUrl);
    if (!res.ok) throw new Error('OSRM API failed');

    const data = await res.json();
    if (!data.routes || data.routes.length === 0) {
      throw new Error('No route found from OSRM');
    }

    const route = data.routes[0];
    const coords: [number, number][] = route.geometry.coordinates; // [lng, lat]

    const pathNodes: PathNode[] = coords.map((c, i) => ({
      id: `osrm_${i}`,
      lng: c[0],
      lat: c[1],
    }));

    const totalDistanceMeters = Math.round(route.distance);
    const estimatedTimeMinutes = Math.max(1, Math.ceil(route.duration / 60));

    const steps: RouteStep[] = [];
    if (route.legs && route.legs[0] && route.legs[0].steps && route.legs[0].steps.length > 0) {
      const osrmSteps = route.legs[0].steps;

      const stepNodes: PathNode[] = osrmSteps.map((s: { maneuver?: { location?: [number, number] } }, idx: number) => {
        const loc = s.maneuver?.location || [coords[0][0], coords[0][1]];
        return {
          id: `step_node_${idx}`,
          lng: loc[0],
          lat: loc[1],
        };
      });

      const finalDestNode: PathNode = pathNodes[pathNodes.length - 1];

      osrmSteps.forEach((s: { maneuver?: { type?: string; modifier?: string }; name?: string; distance: number }, i: number) => {
        let modifier = s.maneuver?.modifier || '';
        let type = s.maneuver?.type || '';
        let nameStr = s.name ? ` on ${s.name}` : '';

        let instruction = `Walk straight${nameStr}`;
        if (type.includes('turn') || modifier) {
          instruction = `Turn ${modifier || 'slightly'}${nameStr}`;
        } else if (type.includes('depart')) {
          instruction = `Head out towards destination`;
        } else if (type.includes('arrive')) {
          instruction = `Arrive at destination`;
        }

        const fromNode = stepNodes[i];
        const toNode = stepNodes[i + 1] || finalDestNode;

        steps.push({
          instruction,
          distanceMeters: Math.round(s.distance),
          fromNode,
          toNode,
        });
      });
    }

    if (steps.length === 0) {
      steps.push({
        instruction: 'Follow highlighted real path to destination',
        distanceMeters: totalDistanceMeters,
        fromNode: pathNodes[0],
        toNode: pathNodes[pathNodes.length - 1],
      });
    }

    return {
      path: pathNodes,
      totalDistanceMeters,
      estimatedTimeMinutes,
      steps,
    };
  } catch (err) {
    // Fallback to internal Dijkstra campus node graph
    const localResult = findShortestPath(startNodeId, targetNodeId, campusData);
    if (localResult) return localResult;

    // Direct fallback if node not linked
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
          instruction: 'Walk directly towards destination',
          distanceMeters: directDist,
          fromNode: { id: 'start', lat: start.lat, lng: start.lng },
          toNode: { id: 'target', lat: target.lat, lng: target.lng },
        },
      ],
    };
  }
}
