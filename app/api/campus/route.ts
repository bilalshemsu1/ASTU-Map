import { NextRequest } from 'next/server';
import campusJson from '@/lib/data/campus.json';
import { CampusData } from '@/lib/types/map';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

const campusData = campusJson as unknown as CampusData;

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    // Allow requesting just buildings or just the path network
    if (type === 'buildings') {
      return jsonResponse({
        version: '1.0.0',
        count: campusData.buildings.length,
        buildings: campusData.buildings,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        },
      });
    }

    if (type === 'paths' || type === 'graph') {
      return jsonResponse({
        version: '1.0.0',
        nodesCount: campusData.nodes.length,
        edgesCount: campusData.edges.length,
        nodes: campusData.nodes,
        edges: campusData.edges,
      }, {
        headers: {
          'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
        },
      });
    }

    // Default: full campus dataset for offline sync
    return jsonResponse({
      version: '1.0.0',
      meta: campusData.meta,
      summary: {
        buildingsCount: campusData.buildings.length,
        nodesCount: campusData.nodes.length,
        edgesCount: campusData.edges.length,
      },
      buildings: campusData.buildings,
      nodes: campusData.nodes,
      edges: campusData.edges,
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      },
    });
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    return jsonResponse(
      { success: false, error: 'Failed to retrieve campus data.', details: errMessage },
      { status: 500 }
    );
  }
}
