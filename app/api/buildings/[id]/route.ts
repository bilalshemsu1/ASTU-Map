import { NextRequest } from 'next/server';
import campusJson from '@/lib/data/campus.json';
import { CampusData, Building, PathNode } from '@/lib/types/map';
import { getFacilityOperatingStatus } from '@/lib/utils/operatingHours';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await context.params;
    const identifier = resolvedParams?.id?.toLowerCase().trim();

    if (!identifier) {
      return jsonResponse(
        { success: false, error: 'Building ID is required.' },
        { status: 400 }
      );
    }

    // Match by ID, Code, or exact Name/Alias
    const building: Building | undefined = campusData.buildings.find(
      (b) =>
        b.id.toLowerCase() === identifier ||
        b.code.toLowerCase() === identifier ||
        b.aliases?.some((a) => a.toLowerCase() === identifier) ||
        b.name.toLowerCase() === identifier
    );

    if (!building) {
      return jsonResponse(
        {
          success: false,
          error: `Building with identifier "${identifier}" not found.`,
          suggestion: 'Check /api/buildings for available building IDs and codes.',
        },
        { status: 404 }
      );
    }

    // Resolve entrance node
    const entranceNode: PathNode | undefined = campusData.nodes.find(
      (n) => n.id === building.entranceNodeId
    );

    // Compute live operating status
    const operatingStatus = getFacilityOperatingStatus(building.details?.operatingHours);

    // Group rooms by floor
    const roomsByFloor = (building.rooms || []).reduce<Record<number, typeof building.rooms>>((acc, room) => {
      const floor = room.floor ?? 0;
      if (!acc[floor]) acc[floor] = [];
      acc[floor].push(room);
      return acc;
    }, {});

    return jsonResponse({
      success: true,
      building: {
        ...building,
        entrance: entranceNode ? { lat: entranceNode.lat, lng: entranceNode.lng, id: entranceNode.id } : null,
        operatingStatus,
        roomsByFloor,
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { success: false, error: 'Failed to retrieve building details.', details: errMessage },
      { status: 500 }
    );
  }
}
