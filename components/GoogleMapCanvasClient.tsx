'use client';

import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Plus, Minus, Copy, Check, MapPin } from 'lucide-react';
import { CampusData, Building, RouteResult, PathNode, LatLng } from '../lib/types/map';

const googleMarkerIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const clickedPinIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [28, 45],
  iconAnchor: [14, 45],
  popupAnchor: [1, -38],
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

function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (coords: { lat: number; lng: number }) => void;
}) {
  useMapEvents({
    click: (e) => {
      onMapClick({
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
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
      className="absolute bottom-60 sm:bottom-52 md:bottom-32 right-4 md:right-6 flex flex-col bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden divide-y divide-gray-200 pointer-events-auto"
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

  const mapCenter: [number, number] = currentNavNode
    ? [currentNavNode.lat, currentNavNode.lng]
    : selectedBuilding
    ? [selectedBuilding.center.lat, selectedBuilding.center.lng]
    : liveUserLocation
    ? [liveUserLocation.lat, liveUserLocation.lng]
    : [meta.center.lat, meta.center.lng];

  const mapZoom = currentNavNode ? 19 : selectedBuilding ? 18 : liveUserLocation ? 18 : meta.zoom || 17;

  const [clickedPoint, setClickedPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState<boolean>(false);

  const handleMapClick = (coords: { lat: number; lng: number }) => {
    setClickedPoint(coords);
    const jsonCoords = `"lat": ${coords.lat}, "lng": ${coords.lng}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(jsonCoords).catch(() => {});
    }
    setCopiedSuccess(true);
    setToastMessage(`Copied: { ${jsonCoords} }`);
    setTimeout(() => setCopiedSuccess(false), 2000);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const routePositions: [number, number][] = routeResult
    ? routeResult.path.map((n) => [n.lat, n.lng])
    : [];

  const startNode = nodes.find((n) => n.id === startNodeId);

  const getTileUrl = () => {
    if (mapType === 'roadmap') {
      return 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
    }
    return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  };

  return (
    <div className="w-full h-full relative z-0">
      {/* Toast Notification Banner for Copied Lat/Lng */}
      {toastMessage && (
        <div
          style={{ zIndex: 9999 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white px-5 py-3 rounded-2xl shadow-2xl border border-emerald-500/50 flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 pointer-events-auto"
        >
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div className="font-mono text-xs text-emerald-300 font-semibold">{toastMessage}</div>
          <button
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      <MapContainer
        center={[meta.center.lat, meta.center.lng]}
        zoom={meta.zoom || 17}
        maxZoom={22}
        zoomControl={false}
        attributionControl={false}
        className="w-full h-full"
      >
        <MapController center={mapCenter} zoom={mapZoom} recenterTrigger={recenterTrigger} />
        <MapClickHandler onMapClick={handleMapClick} />
        <ZoomControls />

        {/* Esri World Imagery Pure Satellite Tiles without external map labels */}
        <TileLayer
          url={getTileUrl()}
          maxZoom={22}
          maxNativeZoom={18}
        />

        {/* Digitizer Clicked Point Marker & Popup */}
        {clickedPoint && (
          <Marker position={[clickedPoint.lat, clickedPoint.lng]} icon={clickedPinIcon}>
            <Popup>
              <div className="p-2 font-sans w-64">
                <div className="flex items-center gap-1.5 text-violet-700 font-bold text-xs mb-1">
                  <MapPin className="w-4 h-4" />
                  <span>Clicked Coordinates</span>
                </div>
                <div className="font-mono bg-slate-900 text-emerald-400 p-2 rounded-lg text-[11px] mb-2 select-all break-all">
                  "lat": {clickedPoint.lat}, "lng": {clickedPoint.lng}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const text = `"lat": ${clickedPoint.lat}, "lng": ${clickedPoint.lng}`;
                      navigator.clipboard?.writeText(text);
                      setToastMessage(`Copied: { ${text} }`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 bg-violet-600 hover:bg-violet-700 text-white py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy JSON</span>
                  </button>
                  <button
                    onClick={() => {
                      const text = `${clickedPoint.lat}, ${clickedPoint.lng}`;
                      navigator.clipboard?.writeText(text);
                      setToastMessage(`Copied: ${text}`);
                    }}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-700 hover:bg-slate-800 text-white py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Raw</span>
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
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
