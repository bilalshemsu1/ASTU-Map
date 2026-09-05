'use client';

import React from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import { CampusData, LatLng } from '../../lib/types/map';

interface DigitizeMapClientProps {
  campus: CampusData;
  mode: 'view' | 'building' | 'node' | 'edge' | 'edit';
  currPolygon: LatLng[];
  selectedSourceNode: string | null;
  onAddMapClick: (latlng: LatLng) => void;
  onNodeClick: (nodeId: string) => void;
  onNodeDragEnd?: (nodeId: string, newLatLng: LatLng) => void;
  onDeleteNode?: (nodeId: string) => void;
  onDeleteEdge?: (edgeId: string) => void;
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
  onDeleteNode,
  onDeleteEdge,
}: DigitizeMapClientProps) {
  const { meta, buildings, nodes, edges } = campus;

  const currentPolyPositions: [number, number][] = currPolygon.map((p) => [p.lat, p.lng]);

  return (
    <div className="w-full h-full min-h-[500px] rounded-lg overflow-hidden relative">
      <MapContainer
        center={[meta.center.lat, meta.center.lng]}
        zoom={meta.zoom || 17}
        minZoom={15}
        maxZoom={22}
        maxBounds={[
          [8.5530, 39.2820],
          [8.5720, 39.3000]
        ]}
        maxBoundsViscosity={1.0}
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

          let color = '#38bdf8'; // sky blue default paved
          let weight = 3;
          let dashArray = undefined;

          if (edge.type === 'asphalt_road') {
            color = '#f59e0b'; // amber for main roads
            weight = 4;
          } else if (edge.type === 'dirt_path') {
            color = '#a16207'; // brown for dirt paths
            dashArray = '6, 6';
          } else if (edge.type === 'stairs') {
            color = '#ef4444'; // red for stairs
            weight = 4;
            dashArray = '2, 6';
          }

          return (
            <Polyline
              key={edge.id}
              positions={[
                [src.lat, src.lng],
                [tgt.lat, tgt.lng],
              ]}
              pathOptions={{ color, weight, dashArray }}
            >
              {(mode === 'view' || mode === 'edit') && (
                <Popup>
                  <strong>Road Edge:</strong> {edge.id}
                  <br />
                  Type: {edge.type || 'paved_walkway'}
                  {edge.isOneWay && <span className="block text-amber-400 font-bold">⚠️ One-Way Only</span>}
                  {edge.handicapAccessible && <span className="block text-emerald-400 font-bold">♿ Wheelchair Accessible</span>}
                  {mode === 'edit' && onDeleteEdge && (
                    <button
                      onClick={() => onDeleteEdge(edge.id)}
                      className="mt-2 text-[11px] bg-red-600 text-white px-2 py-1 rounded font-bold block cursor-pointer w-full"
                    >
                      🗑️ Delete Road Edge
                    </button>
                  )}
                </Popup>
              )}
            </Polyline>
          );
        })}

        {/* Buildings */}
        {buildings.map((b) => (
          <Polygon
            key={b.id}
            positions={b.polygon.map((p) => [p.lat, p.lng])}
            pathOptions={{
              color: '#60a5fa',
              fillColor: '#3b82f6',
              fillOpacity: mode === 'building' ? 0.4 : 0.15,
              interactive: mode === 'view' || mode === 'building',
            }}
          >
            {mode === 'view' && (
              <Popup>
                <strong>{b.code}</strong>: {b.name}
                <br />
                Center: ({b.center.lat.toFixed(5)}, {b.center.lng.toFixed(5)})
              </Popup>
            )}
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
              radius={isSelected ? 8 : (mode === 'edit' ? 7 : 5)}
              pathOptions={{
                color: mode === 'edit' ? '#f59e0b' : '#0284c7',
                fillColor: isSelected ? '#22c55e' : (mode === 'edit' ? '#fbbf24' : '#e2e8f0'),
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
              {(mode === 'view' || mode === 'edit') && (
                <Popup>
                  <strong>{n.label || `Node ${n.id}`}</strong>
                  <br />
                  ID: <span className="font-mono">{n.id}</span>
                  <br />
                  Lat: {n.lat}, Lng: {n.lng}
                  {mode === 'edit' && onDeleteNode && (
                    <button
                      onClick={() => onDeleteNode(n.id)}
                      className="mt-2 text-[11px] bg-red-600 text-white px-2 py-1 rounded font-bold block cursor-pointer w-full"
                    >
                      🗑️ Delete Node
                    </button>
                  )}
                </Popup>
              )}
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
