import type { LatLng } from "./types";
import { haversine } from "./graph";

export type Turn = {
  text: string;
  meters: number;
};

function bearing(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (d: number) => (d * 180) / Math.PI;
  const y = Math.sin(toRad(b.lon - a.lon)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lon - a.lon));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function turnDir(from: number, to: number): "left" | "right" | "straight" | "back" | "slight" {
  const d = ((to - from + 540) % 360) - 180;
  if (Math.abs(d) < 25) return "straight";
  if (Math.abs(d) > 155) return "back";
  if (Math.abs(d) < 60) return "slight";
  if (d > 0) return "left";
  return "right";
}

/**
 * Build turn-by-turn from a raw road polyline (real coordinates).
 * Simplifies to only meaningful direction changes.
 */
export function buildTurns(coords: LatLng[]): Turn[] {
  if (coords.length < 2) return [];
  const turns: Turn[] = [];
  let segStart = coords[0];

  for (let i = 1; i < coords.length - 1; i++) {
    const a = coords[i - 1];
    const b = coords[i];
    const c = coords[i + 1];
    if (haversine(a, b) < 1 && haversine(b, c) < 1) continue;
    const dir = turnDir(bearing(a, b), bearing(b, c));
    const leg = haversine(segStart, b);
    if (dir !== "straight") {
      const verb = dir === "back" ? "retrace" : `turn ${dir}`;
      turns.push({
        text: `${verb}${dir !== "back" ? " " : " "}after ${leg.toFixed(0)} m`,
        meters: leg,
      });
      segStart = b;
    }
  }

  const last = haversine(segStart, coords[coords.length - 1]);
  if (last > 2) turns.push({ text: "Continue to your destination", meters: last });

  return turns;
}