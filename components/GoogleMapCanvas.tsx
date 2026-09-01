'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { CampusData, Building, RouteResult, PathNode, LatLng } from '../lib/types/map';

const GoogleMapCanvasClient = dynamic(() => import('./GoogleMapCanvasClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-500 text-sm">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <span>Loading Google Maps...</span>
      </div>
    </div>
  ),
});

interface GoogleMapCanvasProps {
  campusData: CampusData;
  selectedBuilding: Building | null;
  onSelectBuilding: (building: Building) => void;
  routeResult: RouteResult | null;
  startNodeId?: string | null;
  targetNodeId?: string | null;
  mapType: 'roadmap' | 'satellite' | 'terrain';
  currentNavNode?: PathNode | null;
  liveUserLocation?: LatLng | null;
  onUpdateLiveLocation?: (coords: LatLng) => void;
  recenterTrigger?: number;
}

export default function GoogleMapCanvas(props: GoogleMapCanvasProps) {
  return <GoogleMapCanvasClient {...props} />;
}
