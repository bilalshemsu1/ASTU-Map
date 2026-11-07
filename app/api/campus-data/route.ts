import { jsonResponse, handleOptions } from '@/lib/utils/cors';
import campusJson from '@/lib/data/campus.json';

export function OPTIONS() {
  return handleOptions();
}

export async function GET() {
  return jsonResponse(campusJson, {
    headers: {
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
    },
  });
}
