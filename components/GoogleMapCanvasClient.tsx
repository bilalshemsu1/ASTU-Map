'use client';

import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Minus } from 'lucide-react';
import { CampusData, Building, RouteResult, PathNode, LatLng } from '../lib/types/map';

const googleMarkerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const startPinIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const userLivePinIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [28, 45],
  iconAnchor: [14, 45],
  popupAnchor: [1, -38],
  shadowSize: [41, 41],
});

interface GoogleMapCanvasClientProps {
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

function MapController({
  center,
  zoom,
  recenterTrigger,
}: {
  center: [number, number];
  zoom: number;
  recenterTrigger?: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    let timer: NodeJS.Timeout;
    map.whenReady(() => {
      timer = setTimeout(() => {
        try {
          const container = map.getContainer();
          const pane = map.getPane('mapPane');
          if (container && pane && (pane as unknown as { _leaflet_pos?: unknown })._leaflet_pos !== undefined) {
            map.flyTo(center, zoom, { duration: 0.8 });
          } else {
            map.setView(center, zoom, { animate: false });
          }
        } catch (e) {
          // Safe fallback
        }
      }, 50);
    });

    return () => clearTimeout(timer);
  }, [center[0], center[1], zoom, recenterTrigger, map]);

  return null;
}

function ZoomControls() {
  const map = useMap();
  return (
    <div
      style={{ zIndex: 1000 }}
      className="absolute bottom-52 md:bottom-36 right-4 md:right-6 flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden divide-y divide-gray-200 pointer-events-auto"
    >
      <button
        onClick={() => map.zoomIn()}
        className="w-10 h-10 hover:bg-gray-100 text-gray-800 font-bold flex items-center justify-center transition-colors select-none cursor-pointer"
        title="Zoom In"
      >
        <Plus className="w-5 h-5 stroke-[2.5]" />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-10 h-10 hover:bg-gray-100 text-gray-800 font-bold flex items-center justify-center transition-colors select-none cursor-pointer"
        title="Zoom Out"
      >
        <Minus className="w-5 h-5 stroke-[2.5]" />
      </button>
    </div>
  );
}

export default function GoogleMapCanvasClient({
  campusData,
  selectedBuilding,
  onSelectBuilding,
  routeResult,
  startNodeId,
  mapType,
  currentNavNode,
  liveUserLocation,
  onUpdateLiveLocation,
  recenterTrigger,
}: GoogleMapCanvasClientProps) {
  const { meta, buildings, nodes } = campusData;

  // FIX CAMERA PRIORITY: Explicitly selected building MUST take precedence over liveUserLocation
  const mapCenter: [number, number] = currentNavNode
    ? [currentNavNode.lat, currentNavNode.lng]
    : selectedBuilding
    ? [selectedBuilding.center.lat, selectedBuilding.center.lng]
    : liveUserLocation
    ? [liveUserLocation.lat, liveUserLocation.lng]
    : [meta.center.lat, meta.center.lng];

  const mapZoom = currentNavNode ? 19 : selectedBuilding ? 18 : liveUserLocation ? 18 : meta.zoom || 17;

  const routePositions: [number, number][] = routeResult
    ? routeResult.path.map((n) => [n.lat, n.lng])
    : [];

  const startNode = nodes.find((n) => n.id === startNodeId);

  const getTileUrl = () => {
    if (mapType === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    if (mapType === 'terrain') {
      return 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    }
    return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
  };

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={[meta.center.lat, meta.center.lng]}
        zoom={meta.zoom || 17}
        zoomControl={false}
        className="w-full h-full"
      >
        <MapController center={mapCenter} zoom={mapZoom} recenterTrigger={recenterTrigger} />
        <ZoomControls />

        <TileLayer
          url={getTileUrl()}
          attribution="&copy; OpenStreetMap contributors &copy; CARTO &copy; Esri"
          maxZoom={19}
        />

        {mapType === 'satellite' && (
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
            maxZoom={19}
            opacity={0.8}
          />
        )}

        {/* Building Pins */}
        {buildings.map((b) => (
          <Marker
            key={b.id}
            position={[b.center.lat, b.center.lng]}
            icon={googleMarkerIcon}
            eventHandlers={{
              click: () => onSelectBuilding(b),
            }}
          >
            <Popup>
              <div className="p-1 font-sans">
                <h4 className="font-bold text-sm text-gray-900">{b.name}</h4>
                <p className="text-xs text-blue-600 font-semibold mt-0.5">Code: {b.code}</p>
                {b.rooms.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Rooms: {b.rooms.map((r) => r.name).join(', ')}
                  </p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}

        {/* Live GPS Location Draggable Blue Pin */}
        {liveUserLocation && (
          <Marker
            position={[liveUserLocation.lat, liveUserLocation.lng]}
            icon={userLivePinIcon}
            draggable={true}
            eventHandlers={{
              dragend: (e) => {
                const targetMarker = e.target as L.Marker;
                const pos = targetMarker.getLatLng();
                if (onUpdateLiveLocation) {
                  onUpdateLiveLocation({ lat: pos.lat, lng: pos.lng });
                }
              },
            }}
          >
            <Popup>
              <div className="p-1 text-xs font-sans">
                <strong className="text-blue-600 font-extrabold block">🎯 Your Start / GPS Position</strong>
                <span className="text-gray-500 block text-[10px] mt-0.5">💡 Tip: Drag this blue pin anywhere to adjust your exact start point!</span>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Start Location Marker */}
        {startNode && !currentNavNode && !liveUserLocation && (
          <Marker position={[startNode.lat, startNode.lng]} icon={startPinIcon}>
            <Popup>
              <div className="text-xs font-semibold text-emerald-700">
                Start: {startNode.label || 'Start Location'}
              </div>
            </Popup>
          </Marker>
        )}

        {/* Active Navigation Pulsating Location Blue Circle Marker */}
        {currentNavNode && (
          <CircleMarker
            center={[currentNavNode.lat, currentNavNode.lng]}
            radius={10}
            pathOptions={{
              color: '#ffffff',
              fillColor: '#4285f4',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup>
              <div className="text-xs font-bold text-blue-600">Current Navigation Step</div>
            </Popup>
          </CircleMarker>
        )}

        {/* Google Route Line */}
        {routePositions.length > 1 && (
          <>
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#1a73e8',
                weight: 9,
                opacity: 0.3,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            <Polyline
              positions={routePositions}
              pathOptions={{
                color: '#1a73e8',
                weight: 6,
                opacity: 0.95,
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
