import { NextRequest } from 'next/server';
import { jsonResponse, handleOptions } from '@/lib/utils/cors';

export function OPTIONS() {
  return handleOptions();
}

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || 'localhost:4000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  return jsonResponse({
    name: 'ASTU Campus Navigator API',
    description: 'REST API for Adama Science & Technology University (ASTU) campus navigation, place directory, routing, and AI guide.',
    version: '1.0.0',
    status: 'operational',
    baseUrl,
    cors: {
      enabled: true,
      allowedOrigins: '*',
      allowedMethods: ['GET', 'POST', 'OPTIONS'],
    },
    endpoints: [
      {
        path: '/api/campus',
        method: 'GET',
        description: 'Complete campus dataset (buildings, nodes, edges, bounds) for mobile offline-first caching.',
        queryParams: {
          type: 'Optional filter: "buildings" | "graph" | "paths"',
        },
        example: `${baseUrl}/api/campus`,
      },
      {
        path: '/api/buildings',
        method: 'GET',
        description: 'List campus buildings with category filters and open-now checks.',
        queryParams: {
          category: 'Filter by: academic | administrative | dormitory | dining | library | sports',
          q: 'Text search by name, code, room, or department',
          open_now: 'Filter only currently open facilities (true | false)',
        },
        example: `${baseUrl}/api/buildings?category=academic`,
      },
      {
        path: '/api/buildings/:id',
        method: 'GET',
        description: 'Retrieve full details for a building (rooms by floor, entrance coordinates, contacts, live operating status).',
        params: {
          id: 'Building ID (e.g. "soeec_main", "clib") or code (e.g. "B51", "B7")',
        },
        example: `${baseUrl}/api/buildings/soeec_main`,
      },
      {
        path: '/api/search',
        method: 'GET',
        description: 'Ranked search across building codes, full names, rooms, services, and aliases.',
        queryParams: {
          q: 'Search string (required, e.g. "cse", "library", "b7", "transcripts")',
          category: 'Optional category filter',
          limit: 'Max results count (default: 15)',
        },
        example: `${baseUrl}/api/search?q=library`,
      },
      {
        path: '/api/places/nearby',
        method: 'GET',
        description: 'Find campus amenities and buildings sorted by distance from user GPS coordinates.',
        queryParams: {
          lat: 'User latitude (e.g. 8.55621)',
          lng: 'User longitude (e.g. 39.29104)',
          radius: 'Search radius in meters (default: 1000)',
          category: 'Optional category filter (e.g. dining, library)',
          limit: 'Max results (default: 10)',
        },
        example: `${baseUrl}/api/places/nearby?lat=8.55621&lng=39.29104&category=dining`,
      },
      {
        path: '/api/route',
        aliases: ['/api/directions'],
        method: 'POST / GET',
        description: 'High-precision Dijkstra campus walking pathfinder with turn-by-turn guidance and polyline coordinates.',
        bodyExample: {
          origin: { lat: 8.55621, lng: 39.29104 },
          destination: { buildingId: 'soeec_main' },
          accessible: false,
        },
        getExample: `${baseUrl}/api/route?from=8.55621,39.29104&to=soeec_main`,
      },
      {
        path: '/api/chat',
        method: 'POST',
        description: 'Ground truth ASTU AI Campus Guide (Groq LLaMA 3.3 70B) with structured place recommendations and navigation intents.',
        bodyExample: {
          message: 'Where is the school of computing?',
          userLocation: { lat: 8.55621, lng: 39.29104 },
          history: [],
        },
      },
    ],
  });
}
