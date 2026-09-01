"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { campus } from "@/lib/graph";
import type { LatLng } from "@/lib/types";

type Props = {
  route?: LatLng[];
  startPoint?: LatLng;
  endPoint?: LatLng;
  picking?: boolean;
  highlightPoiId?: string;
  onPickPoint?: (p: LatLng) => void;
};

const GOOGLE_BLUE = "#4285F4";

function divIcon(html: string, size = 26): L.DivIcon {
  return L.divIcon({
    className: "app-marker",
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const poiIcon = () =>
  divIcon(
    `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#ffffff;border:2px solid ${GOOGLE_BLUE};display:flex;align-items:center;justify-content:center;"><div style="width:8px;height:8px;border-radius:50%;background:${GOOGLE_BLUE};"></div></div>`,
    22,
  );

const startIcon = () =>
  divIcon(
    `<div style="width:24px;height:24px;border-radius:50%;background:#1a73e8;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    24,
  );

const endIcon = () =>
  divIcon(
    `<div style="width:24px;height:24px;border-radius:50%;background:#d93025;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4);"></div>`,
    24,
  );

function createMap(el: HTMLElement): L.Map {
  // OSM raster tiles — free, real, no API key.
  const map = L.map(el, { zoomControl: false, attributionControl: true }).setView(
    [campus.center.lat, campus.center.lon],
    16,
  );
  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  return map;
}

export default function CampusMapInner({
  route: routeCoords,
  startPoint,
  endPoint,
  picking = false,
  highlightPoiId,
  onPickPoint,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pickingRef = useRef(picking);
  const onPickRef = useRef(onPickPoint);

  useEffect(() => {
    pickingRef.current = picking;
    onPickRef.current = onPickPoint;
  }, [picking, onPickPoint]);

  // Layer references
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const poiLayerRef = useRef<L.LayerGroup | null>(null);
  const pinsRef = useRef<L.LayerGroup | null>(null);
  const highlightMarkerRef = useRef<L.Marker | null>(null);

  // Init map once
  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = createMap(hostRef.current);
    mapRef.current = map;

    routeLayerRef.current = L.layerGroup().addTo(map);
    poiLayerRef.current = L.layerGroup().addTo(map);
    pinsRef.current = L.layerGroup().addTo(map);

    // POI markers
    for (const poi of campus.pois) {
      L.marker([poi.lat, poi.lon], { icon: poiIcon() })
        .addTo(poiLayerRef.current!)
        .bindTooltip(poi.name, { direction: "top", offset: L.point(0, -12) });
    }

    // click-to-pick (Google-maps style blue pin behavior only when picking)
    map.on("click", (e: L.LeafletMouseEvent) => {
      if (pickingRef.current && onPickRef.current) {
        onPickRef.current({ lat: e.latlng.lat, lon: e.latlng.lng });
      }
    });

    // Init view to cover all POIs
    const all: L.LatLng[] = [...campus.pois.map((p) => L.latLng(p.lat, p.lon))];
    if (startPoint) all.push(L.latLng(startPoint.lat, startPoint.lon));
    if (endPoint) all.push(L.latLng(endPoint.lat, endPoint.lon));
    if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [60, 60] });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Route polyline
  useEffect(() => {
    const group = routeLayerRef.current;
    if (!group) return;
    group.clearLayers();
    if (routeCoords && routeCoords.length >= 2) {
      L.polyline(routeCoords.map((c) => [c.lat, c.lon]), {
        color: GOOGLE_BLUE,
        weight: 6,
        opacity: 0.9,
      }).addTo(group);
    }
  }, [routeCoords]);

  // Start / end pins
  useEffect(() => {
    const group = pinsRef.current;
    if (!group) return;
    group.clearLayers();
    if (startPoint) L.marker([startPoint.lat, startPoint.lon], { icon: startIcon() }).addTo(group);
    if (endPoint) L.marker([endPoint.lat, endPoint.lon], { icon: endIcon() }).addTo(group);
  }, [startPoint, endPoint]);

  // Highlighted destination POI (big blue pin, Google-style)
  useEffect(() => {
    if (!mapRef.current) return;
    if (highlightMarkerRef.current) {
      highlightMarkerRef.current.remove();
      highlightMarkerRef.current = null;
    }
    if (!highlightPoiId) return;
    const poi = campus.pois.find((p) => p.id === highlightPoiId);
    if (!poi) return;
    const m = L.marker([poi.lat, poi.lon], {
      icon: divIcon(
        `<div style="width:30px;height:30px;border-radius:50%;background:${GOOGLE_BLUE};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center;"><div style="width:10px;height:10px;border-radius:50%;background:#fff;"></div></div>`,
        30,
      ),
      zIndexOffset: 1000,
    });
    m.addTo(mapRef.current);
    highlightMarkerRef.current = m;
  }, [highlightPoiId]);

  const cursor = picking ? "crosshair" : "grab";

  return (
    <div className="fixed inset-0">
      <div ref={hostRef} className="absolute inset-0" style={{ cursor }} />
    </div>
  );
}