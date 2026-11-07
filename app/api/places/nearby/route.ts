import { NextRequest } from 'next/server';
import campusJson from '@/lib/data/campus.json';
import { CampusData, Building, PathNode } from '@/lib/types/map';
import { calculateHaversineDistance, formatDistance, formatTime } from '@/lib/utils/graph';
import { getFacilityOperatingStatus } from '@/lib/utils/operatingHours';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const latParam = searchParams.get('lat');
    const lngParam = searchParams.get('lng');
    const radiusParam = searchParams.get('radius');
    const category = searchParams.get('category')?.toLowerCase().trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 50);

    if (!latParam || !lngParam) {
      return jsonResponse(
        {
          success: false,
          error: 'Missing required query parameters: "lat" and "lng" are required (e.g. ?lat=8.556&lng=39.291).',
        },
        { status: 400 }
      );
    }

    const userLat = parseFloat(latParam);
    const userLng = parseFloat(lngParam);

    if (isNaN(userLat) || isNaN(userLng)) {
      return jsonResponse(
        { success: false, error: 'Invalid coordinates provided. "lat" and "lng" must be valid numbers.' },
        { status: 400 }
      );
    }

    const radiusMeters = radiusParam ? parseFloat(radiusParam) : 1000;
    const userCoord = { lat: userLat, lng: userLng };

    // Node map for fast entrance resolution
    const nodeMap = new Map<string, PathNode>();
    for (const node of campusData.nodes) {
      nodeMap.set(node.id, node);
    }

    let candidateBuildings: Building[] = campusData.buildings;
    if (category) {
      candidateBuildings = candidateBuildings.filter(
        (b) => b.category.toLowerCase() === category
      );
    }

    // Measure distance to each building entrance (or center if entrance missing)
    const nearby = candidateBuildings
      .map((b) => {
        const entranceNode = nodeMap.get(b.entranceNodeId);
        const destinationPoint = entranceNode
          ? { lat: entranceNode.lat, lng: entranceNode.lng }
          : b.center;

        const distanceMeters = Math.round(calculateHaversineDistance(userCoord, destinationPoint));
        const estimatedMinutes = Math.max(1, Math.round((distanceMeters / 1.35) / 60));
        const status = getFacilityOperatingStatus(b.details?.operatingHours);

        return {
          building: {
            id: b.id,
            code: b.code,
            name: b.name,
            category: b.category,
            department: b.details?.department,
            center: b.center,
            entrance: destinationPoint,
            isOpen: status.isOpen,
          },
          distanceMeters,
          distanceFormatted: formatDistance(distanceMeters),
          estimatedMinutes,
          timeFormatted: formatTime(estimatedMinutes),
        };
      })
      .filter((item) => item.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, limit);

    return jsonResponse({
      origin: userCoord,
      radiusMeters,
      count: nearby.length,
      places: nearby,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { success: false, error: 'Failed to calculate nearby places.', details: errMessage },
      { status: 500 }
    );
  }
}
