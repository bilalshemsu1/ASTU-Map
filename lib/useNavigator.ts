"use client";

import { useEffect, useMemo, useState } from "react";
import {
  campus,
  haversine,
  nearestNodeId,
  nodeCoord,
  poiNodeId,
  shortestPathByNodeId,
  type RouteResult,
} from "./graph";
import { buildTurns, type Turn } from "./turns";
import type { SearchResult } from "./search";
import type { LatLng } from "./types";

export type Stop = {
  poiId?: string;
  coordId?: string;
  label: string;
};

export type RouteStatus = "idle" | "ready" | "unreachable";

export type NavigateState = {
  start: Stop | null;
  end: Stop | null;
  route: RouteResult | null;
  status: RouteStatus;
  turns: Turn[];
};

/** A real POI to use as the default start (campus entry), if usable. */
function defaultStartPoi() {
  const place = campus.pois.find((p) => /astu/i.test(p.name) && p.kind === "place" && poiNodeId(p.id));
  return place ?? campus.pois.find((p) => poiNodeId(p.id));
}

export function useNavigator() {
  const [start, setStart] = useState<Stop | null>(() => {
    const p = defaultStartPoi();
    return p ? { poiId: p.id, label: p.name } : null;
  });
  const [end, setEnd] = useState<Stop | null>(null);

  // Attempt real GPS once; snap to nearest road node if granted (and on campus).
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        if (haversine(ll, campus.center) > 2000) return; // not on campus
        const id = nearestNodeId(ll);
        if (!id) return;
        setStart({ coordId: id, label: "Your location" });
      },
      () => {
        // permission denied → keep default campus entry start
      },
      { timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  const route = useMemo(() => {
    if (!start || !end) return null;
    const s = start.poiId ? poiNodeId(start.poiId) : start.coordId;
    const e = end.poiId ? poiNodeId(end.poiId) : end.coordId;
    if (!s || !e) return null;
    return shortestPathByNodeId(s, e);
  }, [start, end]);

  const status: RouteStatus = !end ? "idle" : route ? "ready" : "unreachable";

  const turns = useMemo(() => (route ? buildTurns(route.coords) : []), [route]);

  const fromResult = (r: SearchResult, asStart: boolean) => {
    const stop: Stop = {
      poiId: r.poi.id,
      label: r.room ? `${r.poi.name}, Room ${r.room.number}` : r.poi.name,
    };
    if (asStart) setStart(stop);
    else setEnd(stop);
  };

  const stopPoint = (stop: Stop | null): LatLng | undefined => {
    if (!stop) return undefined;
    if (stop.coordId) {
      const c = nodeCoord(stop.coordId);
      if (c) return c;
    }
    if (stop.poiId) {
      const p = campus.pois.find((x) => x.id === stop.poiId);
      if (p) return { lat: p.lat, lon: p.lon };
    }
    return undefined;
  };

  const setFromPoint = (asStart: boolean) => (ll: LatLng) => {
    const id = nearestNodeId(ll);
    if (!id) return;
    const s: Stop = { coordId: id, label: "Picked point" };
    if (asStart) setStart(s);
    else setEnd(s);
  };

  const clearEnd = () => setEnd(null);

  const swap = () => {
    setStart(end);
    setEnd(start);
  };

  return { start, end, route, status, turns, fromResult, setFromPoint, clearEnd, swap, stopPoint };
}