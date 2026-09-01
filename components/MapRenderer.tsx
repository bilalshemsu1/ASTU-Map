'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { CampusData, Building, RouteResult } from '../lib/types/map';

const MapRendererClient = dynamic(() => import('./MapRendererClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 text-sm">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
        <span>Loading Satellite Map...</span>
      </div>
    </div>
  ),
});

interface MapRendererProps {
  campusData: CampusData;
  selectedBuilding: Building | null;
  onSelectBuilding: (building: Building) => void;
  routeResult: RouteResult | null;
  startNodeId?: string | null;
  targetNodeId?: string | null;
  onNodeClick?: (nodeId: string) => void;
  showNodesAndEdges?: boolean;
}

export default function MapRenderer(props: MapRendererProps) {
  return <MapRendererClient {...props} />;
}
