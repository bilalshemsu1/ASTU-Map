import { NextRequest } from 'next/server';
import campusJson from '@/lib/data/campus.json';
import { CampusData, PathNode } from '@/lib/types/map';
import { searchCampus } from '@/lib/utils/search';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get('q')?.trim() || searchParams.get('query')?.trim() || '';
    const category = searchParams.get('category')?.toLowerCase().trim();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '15', 10), 1), 50);

    if (!query) {
      return jsonResponse({
        query: '',
        count: 0,
        results: [],
      });
    }

    let searchResults = searchCampus(query, campusData);

    if (category) {
      searchResults = searchResults.filter((r) => r.building.category.toLowerCase() === category);
    }

    const trimmedResults = searchResults.slice(0, limit);

    // Node lookup map for fast entrance resolution
    const nodeMap = new Map<string, PathNode>();
    for (const node of campusData.nodes) {
      nodeMap.set(node.id, node);
    }

    const formatted = trimmedResults.map((r) => {
      const entranceNode = nodeMap.get(r.building.entranceNodeId);
      return {
        score: r.score,
        building: {
          id: r.building.id,
          code: r.building.code,
          name: r.building.name,
          category: r.building.category,
          aliases: r.building.aliases || [],
          department: r.building.details?.department,
          center: r.building.center,
          entrance: entranceNode ? { lat: entranceNode.lat, lng: entranceNode.lng } : r.building.center,
        },
        matchingRoom: r.matchingRoom
          ? {
              id: r.matchingRoom.id,
              name: r.matchingRoom.name,
              floor: r.matchingRoom.floor,
              type: r.matchingRoom.type,
              workDescription: r.matchingRoom.workDescription,
            }
          : null,
      };
    });

    return jsonResponse({
      query,
      count: formatted.length,
      results: formatted,
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { success: false, error: 'Search failed.', details: errMessage },
      { status: 500 }
    );
  }
}
