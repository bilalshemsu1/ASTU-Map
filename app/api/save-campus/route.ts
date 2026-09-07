import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function POST(request: Request) {
  try {
    const data = await request.json();

    if (!data || typeof data !== 'object' || !Array.isArray(data.buildings) || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
      return NextResponse.json(
        { success: false, error: 'Invalid campus data format.' },
        { status: 400 }
      );
    }

    const formattedJson = JSON.stringify(data, null, 2);

    const targetPaths = [
      path.join(process.cwd(), 'lib', 'data', 'campus.json'),
      path.join(process.cwd(), 'lib', 'campus.json'),
      path.join(process.cwd(), 'campus.json'),
    ];

    await Promise.all(
      targetPaths.map(async (filePath) => {
        try {
          await fs.writeFile(filePath, formattedJson, 'utf-8');
        } catch (err) {
          console.warn(`Could not update ${filePath}:`, err);
        }
      })
    );

    return NextResponse.json({
      success: true,
      message: 'Campus data updated successfully across files!',
    });
  } catch (error: any) {
    console.error('Error saving campus data:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to save campus data.' },
      { status: 500 }
    );
  }
}
