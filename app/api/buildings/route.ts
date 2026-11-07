import { NextRequest } from 'next/server';
import campusJson from '@/lib/data/campus.json';
import { CampusData, Building } from '@/lib/types/map';
import { getFacilityOperatingStatus } from '@/lib/utils/operatingHours';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get('category')?.toLowerCase().trim();
    const query = searchParams.get('q')?.toLowerCase().trim() || searchParams.get('search')?.toLowerCase().trim();
    const openNow = searchParams.get('open_now') === 'true';

    let buildings: Building[] = campusData.buildings;

    // Filter by category
    if (category) {
      buildings = buildings.filter((b) => b.category.toLowerCase() === category);
    }

    // Filter by text search query
    if (query) {
      buildings = buildings.filter((b) => {
        const matchesCode = b.code.toLowerCase().includes(query);
        const matchesName = b.name.toLowerCase().includes(query);
        const matchesDept = b.details?.department?.toLowerCase().includes(query) ?? false;
        const matchesAlias = b.aliases?.some((a) => a.toLowerCase().includes(query)) ?? false;
        const matchesRoom = b.rooms?.some((r) => r.name.toLowerCase().includes(query)) ?? false;
        return matchesCode || matchesName || matchesDept || matchesAlias || matchesRoom;
      });
    }

    // Filter by currently open status
    if (openNow) {
      buildings = buildings.filter((b) => {
        const status = getFacilityOperatingStatus(b.details?.operatingHours);
        return status.isOpen;
      });
    }

    // Attach brief status to each building
    const results = buildings.map((b) => {
      const status = getFacilityOperatingStatus(b.details?.operatingHours);
      return {
        id: b.id,
        code: b.code,
        name: b.name,
        category: b.category,
        aliases: b.aliases || [],
        center: b.center,
        entranceNodeId: b.entranceNodeId,
        department: b.details?.department,
        hours: b.details?.hours,
        isOpen: status.isOpen,
        roomCount: b.rooms?.length || 0,
        images: b.details?.images || [],
      };
    });

    // Available categories aggregation
    const categoriesCount = campusData.buildings.reduce<Record<string, number>>((acc, b) => {
      acc[b.category] = (acc[b.category] || 0) + 1;
      return acc;
    }, {});

    return jsonResponse({
      count: results.length,
      totalBuildings: campusData.buildings.length,
      categories: categoriesCount,
      buildings: results,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { success: false, error: 'Failed to fetch buildings.', details: errMessage },
      { status: 500 }
    );
  }
}
