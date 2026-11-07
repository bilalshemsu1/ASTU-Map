import { NextRequest } from 'next/server';
import campusJson from '@/lib/data/campus.json';
import { CampusData, LatLng, PathNode, Building } from '@/lib/types/map';
import { fetchRealWalkingRoute } from '@/lib/utils/routing';
import { formatDistance, formatTime } from '@/lib/utils/graph';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

interface LocationInput {
  lat?: number;
  lng?: number;
  buildingId?: string;
  buildingCode?: string;
  nodeId?: string;
  name?: string;
}

interface RouteRequestBody {
  origin?: LocationInput | string;
  destination?: LocationInput | string;
  from?: LocationInput | string;
  to?: LocationInput | string;
  accessible?: boolean;
  avoidStairs?: boolean;
}

/**
 * Resolves an arbitrary location input (lat/lng, buildingId, code, or node ID)
 * into a concrete LatLng coordinate, graph node ID, and human-readable label.
 */
function resolveLocation(
  input: LocationInput | string | undefined | null,
  fallbackLabel: string
): { coord: LatLng; nodeId: string; label: string } | null {
  if (!input) return null;

  // Case 1: Comma-separated string "lat,lng" or building identifier string
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (trimmed.includes(',')) {
      const [latStr, lngStr] = trimmed.split(',');
      const lat = parseFloat(latStr);
      const lng = parseFloat(lngStr);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { coord: { lat, lng }, nodeId: '', label: fallbackLabel };
      }
    }
    // Try building ID or code
    const building = findBuildingByIdentifier(trimmed);
    if (building) {
      return getBuildingLocation(building);
    }
    // Try node ID
    const node = campusData.nodes.find((n) => n.id.toLowerCase() === trimmed.toLowerCase());
    if (node) {
      return { coord: { lat: node.lat, lng: node.lng }, nodeId: node.id, label: node.label || node.id };
    }
    return null;
  }

  // Case 2: Object with lat and lng
  if (typeof input.lat === 'number' && typeof input.lng === 'number' && !isNaN(input.lat) && !isNaN(input.lng)) {
    return {
      coord: { lat: input.lat, lng: input.lng },
      nodeId: input.nodeId || '',
      label: input.name || fallbackLabel,
    };
  }

  // Case 3: Object with buildingId or buildingCode
  const bId = input.buildingId || input.buildingCode || input.name;
  if (bId) {
    const building = findBuildingByIdentifier(bId);
    if (building) {
      return getBuildingLocation(building);
    }
  }

  // Case 4: Object with nodeId
  if (input.nodeId) {
    const node = campusData.nodes.find((n) => n.id === input.nodeId);
    if (node) {
      return { coord: { lat: node.lat, lng: node.lng }, nodeId: node.id, label: node.label || node.id };
    }
  }

  return null;
}

function findBuildingByIdentifier(identifier: string): Building | undefined {
  const clean = identifier.toLowerCase().trim();
  return campusData.buildings.find(
    (b) =>
      b.id.toLowerCase() === clean ||
      b.code.toLowerCase() === clean ||
      b.name.toLowerCase() === clean ||
      b.aliases?.some((a) => a.toLowerCase() === clean)
  );
}

function getBuildingLocation(building: Building): { coord: LatLng; nodeId: string; label: string } {
  const entranceNode = campusData.nodes.find((n) => n.id === building.entranceNodeId);
  const coord = entranceNode ? { lat: entranceNode.lat, lng: entranceNode.lng } : building.center;
  return {
    coord,
    nodeId: entranceNode?.id || building.entranceNodeId,
    label: `${building.name} (${building.code})`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RouteRequestBody;
    const originRaw = body.origin ?? body.from;
    const destRaw = body.destination ?? body.to;

    const origin = resolveLocation(originRaw, 'Start Location');
    const destination = resolveLocation(destRaw, 'Destination');

    if (!origin) {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid or missing origin. Provide { lat, lng } or a valid buildingId (e.g. "soeec_main").',
        },
        { status: 400 }
      );
    }

    if (!destination) {
      return jsonResponse(
        {
          success: false,
          error: 'Invalid or missing destination. Provide { lat, lng } or a valid buildingId (e.g. "clib").',
        },
        { status: 400 }
      );
    }

    const routeResult = await fetchRealWalkingRoute(
      origin.coord,
      destination.coord,
      origin.nodeId,
      destination.nodeId,
      campusData,
      {
        accessibleOnly: body.accessible || false,
        avoidStairs: body.avoidStairs || false,
      }
    );

    if (!routeResult || routeResult.path.length === 0) {
      return jsonResponse(
        {
          success: false,
          error: 'No walking path could be found between the specified origin and destination.',
        },
        { status: 404 }
      );
    }

    // Coordinates arrays: [lat, lng] for Leaflet/Google, and GeoJSON [lng, lat] for Mapbox
    const latLngCoordinates = routeResult.path.map((node) => [node.lat, node.lng] as [number, number]);
    const geoJsonCoordinates = routeResult.path.map((node) => [node.lng, node.lat] as [number, number]);

    const formattedSteps = routeResult.steps.map((step, idx) => ({
      stepNumber: idx + 1,
      instruction: step.instruction,
      distanceMeters: step.distanceMeters,
      distanceFormatted: formatDistance(step.distanceMeters),
      from: { id: step.fromNode.id, lat: step.fromNode.lat, lng: step.fromNode.lng },
      to: { id: step.toNode.id, lat: step.toNode.lat, lng: step.toNode.lng },
    }));

    return jsonResponse({
      success: true,
      summary: {
        totalDistanceMeters: routeResult.totalDistanceMeters,
        distanceFormatted: formatDistance(routeResult.totalDistanceMeters),
        estimatedTimeMinutes: routeResult.estimatedTimeMinutes,
        timeFormatted: formatTime(routeResult.estimatedTimeMinutes),
        waypointsCount: routeResult.path.length,
        stepsCount: formattedSteps.length,
      },
      origin: {
        label: origin.label,
        coord: origin.coord,
      },
      destination: {
        label: destination.label,
        coord: destination.coord,
      },
      coordinates: latLngCoordinates,
      geoJson: {
        type: 'LineString',
        coordinates: geoJsonCoordinates,
      },
      steps: formattedSteps,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { success: false, error: 'Route calculation failed.', details: errMessage },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get('from') || searchParams.get('origin');
  const toParam = searchParams.get('to') || searchParams.get('destination');
  const accessible = searchParams.get('accessible') === 'true';

  if (!fromParam || !toParam) {
    return jsonResponse(
      {
        success: false,
        error: 'Missing query parameters: "from" and "to" are required (e.g. ?from=8.556,39.291&to=soeec_main).',
      },
      { status: 400 }
    );
  }

  // Simulate POST request with the query params
  const simulatedReq = new NextRequest(req.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      from: fromParam,
      to: toParam,
      accessible,
    }),
  });

  return POST(simulatedReq);
}
