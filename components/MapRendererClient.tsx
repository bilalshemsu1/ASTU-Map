'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { CampusData, Building, RouteResult } from '../lib/types/map';

// Fix Leaflet default icon paths in Next.js
const defaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = defaultIcon;

interface MapRendererClientProps {
  campusData: CampusData;
  selectedBuilding: Building | null;
  onSelectBuilding: (building: Building) => void;
  routeResult: RouteResult | null;
  startNodeId?: string | null;
  targetNodeId?: string | null;
  showNodesAndEdges?: boolean;
}

// Controller component to smoothly fly/pan map when route or building changes
function MapController({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
}

export default function MapRendererClient({
  campusData,
  selectedBuilding,
  onSelectBuilding,
  routeResult,
  startNodeId,
  targetNodeId,
  showNodesAndEdges = false,
}: MapRendererClientProps) {
  const { meta, buildings, nodes, edges } = campusData;

  const mapCenter: [number, number] = selectedBuilding
    ? [selectedBuilding.center.lat, selectedBuilding.center.lng]
    : [meta.center.lat, meta.center.lng];

  // Route Polyline LatLng points
  const routeLatLngs: [number, number][] = routeResult
    ? routeResult.path.map((n) => [n.lat, n.lng])
    : [];

  const getCategoryColor = (category: Building['category']) => {
    switch (category) {
      case 'academic':
        return '#3b82f6';
      case 'administrative':
        return '#8b5cf6';
      case 'library':
        return '#10b981';
      case 'dining':
        return '#f59e0b';
      case 'dormitory':
        return '#ec4899';
      default:
        return '#6b7280';
    }
  };

  return (
    <div className="w-full h-full min-h-[500px] rounded-xl overflow-hidden shadow-2xl border border-slate-800 relative">
      <MapContainer
        center={[meta.center.lat, meta.center.lng]}
        zoom={meta.zoom || 17}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <MapController center={mapCenter} zoom={selectedBuilding ? 18 : meta.zoom || 17} />

        {/* Real World Satellite Tile Layer from Esri */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          maxZoom={19}
        />

        {/* Optional OpenStreetMap Labels Overlay for clear context */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          maxZoom={19}
          opacity={0.7}
        />

        {/* Path Edges Network */}
        {edges.map((edge) => {
          const src = nodes.find((n) => n.id === edge.source);
          const tgt = nodes.find((n) => n.id === edge.target);
          if (!src || !tgt) return null;
          return (
            <Polyline
              key={edge.id}
              positions={[
                [src.lat, src.lng],
                [tgt.lat, tgt.lng],
              ]}
              pathOptions={{
                color: showNodesAndEdges ? '#e2e8f0' : '#94a3b8',
                weight: showNodesAndEdges ? 3 : 1.5,
                dashArray: '4, 4',
                opacity: showNodesAndEdges ? 0.8 : 0.25,
              }}
            />
          );
        })}

        {/* Path Nodes */}
        {nodes.map((n) => {
          const isStart = startNodeId === n.id;
          const isTarget = targetNodeId === n.id;
          if (!showNodesAndEdges && !isStart && !isTarget) return null;

          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={isStart || isTarget ? 8 : 4}
              pathOptions={{
                color: '#ffffff',
                fillColor: isStart ? '#22c55e' : isTarget ? '#ef4444' : '#0284c7',
                fillOpacity: 0.9,
                weight: 2,
              }}
            >
              {n.label && <Popup>{n.label}</Popup>}
            </CircleMarker>
          );
        })}

        {/* Building Polygons */}
        {buildings.map((b) => {
          const isSelected = selectedBuilding?.id === b.id;
          const color = getCategoryColor(b.category);
          const positions: [number, number][] = b.polygon.map((p) => [p.lat, p.lng]);

          return (
            <React.Fragment key={b.id}>
              <Polygon
                positions={positions}
                pathOptions={{
                  color: isSelected ? '#f43f5e' : color,
                  fillColor: isSelected ? '#f43f5e' : color,
                  fillOpacity: isSelected ? 0.65 : 0.45,
                  weight: isSelected ? 3 : 2,
                }}
                eventHandlers={{
                  click: () => onSelectBuilding(b),
                }}
              >
                <Popup>
                  <div className="p-1 text-slate-900">
                    <h3 className="font-bold text-sm text-sky-700">{b.name}</h3>
                    <p className="text-xs text-slate-600 font-semibold mb-1">Code: {b.code}</p>
                    <p className="text-xs text-slate-500 mb-2">
                      📍 ({b.center.lat.toFixed(5)}, {b.center.lng.toFixed(5)})
                    </p>
                    {b.rooms.length > 0 && (
                      <div className="border-t border-slate-200 pt-1">
                        <span className="text-[11px] font-bold text-slate-700">Rooms:</span>
                        <ul className="text-[11px] text-slate-600 list-disc pl-3 mt-0.5 max-h-24 overflow-y-auto">
                          {b.rooms.map((r) => (
                            <li key={r.id}>{r.name}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Popup>
              </Polygon>

              {/* Building Marker at Center */}
              <Marker
                position={[b.center.lat, b.center.lng]}
                eventHandlers={{
                  click: () => onSelectBuilding(b),
                }}
              >
                <Popup>
                  <strong className="text-xs">{b.code}</strong> - {b.name}
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Calculated Walking Route Highlight Polyline */}
        {routeLatLngs.length > 1 && (
          <>
            {/* Outer Glow */}
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: '#38bdf8',
                weight: 8,
                opacity: 0.4,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Inner Main Line */}
            <Polyline
              positions={routeLatLngs}
              pathOptions={{
                color: '#0284c7',
                weight: 5,
                opacity: 0.9,
                dashArray: '8, 6',
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}
      </MapContainer>
    </div>
  );
}
