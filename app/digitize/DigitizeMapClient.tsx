'use client';

import React from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import { CampusData, LatLng } from '../../lib/types/map';

interface DigitizeMapClientProps {
  campus: CampusData;
  mode: 'view' | 'building' | 'node' | 'edge';
  currPolygon: LatLng[];
  selectedSourceNode: string | null;
  onAddMapClick: (latlng: LatLng) => void;
  onNodeClick: (nodeId: string) => void;
}

function MapClickHandler({ onClick }: { onClick: (latlng: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function DigitizeMapClient({
  campus,
  mode,
  currPolygon,
  selectedSourceNode,
  onAddMapClick,
  onNodeClick,
}: DigitizeMapClientProps) {
  const { meta, buildings, nodes, edges } = campus;

  const currentPolyPositions: [number, number][] = currPolygon.map((p) => [p.lat, p.lng]);

  return (
    <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden relative">
      <MapContainer
        center={[meta.center.lat, meta.center.lng]}
        zoom={meta.zoom || 17}
        className="w-full h-full"
      >
        <MapClickHandler onClick={onAddMapClick} />

        {/* Google Maps High-Resolution Pure Satellite Tiles (No Labels) */}
        <TileLayer
          url="https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}"
          subdomains={['0', '1', '2', '3']}
          tileSize={256}
          zoomOffset={0}
          attribution="&copy; Google Maps Satellite"
          maxZoom={22}
          maxNativeZoom={20}
        />

        {/* Path Edges */}
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
              pathOptions={{ color: '#38bdf8', weight: 2, dashArray: '4, 4' }}
            />
          );
        })}

        {/* Buildings */}
        {buildings.map((b) => (
          <Polygon
            key={b.id}
            positions={b.polygon.map((p) => [p.lat, p.lng])}
            pathOptions={{ color: '#60a5fa', fillColor: '#3b82f6', fillOpacity: 0.4 }}
          >
            <Popup>
              <strong>{b.code}</strong>: {b.name}
              <br />
              Center: ({b.center.lat.toFixed(5)}, {b.center.lng.toFixed(5)})
            </Popup>
          </Polygon>
        ))}

        {/* In-progress Polygon */}
        {currentPolyPositions.length > 0 && (
          <Polygon
            positions={currentPolyPositions}
            pathOptions={{ color: '#fbbf24', fillColor: '#f59e0b', fillOpacity: 0.3 }}
          />
        )}

        {/* Path Nodes */}
        {nodes.map((n) => {
          const isSelected = selectedSourceNode === n.id;
          return (
            <CircleMarker
              key={n.id}
              center={[n.lat, n.lng]}
              radius={isSelected ? 8 : 5}
              pathOptions={{
                color: '#0284c7',
                fillColor: isSelected ? '#22c55e' : '#e2e8f0',
                fillOpacity: 0.9,
                weight: 2,
              }}
              eventHandlers={{
                click: (e) => {
                  e.originalEvent.stopPropagation();
                  onNodeClick(n.id);
                },
              }}
            >
              <Popup>
                {n.label || `Node ${n.id}`}
                <br />
                Lat: {n.lat}, Lng: {n.lng}
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
