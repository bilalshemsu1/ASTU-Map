export type LatLng = { lat: number; lon: number };

export type Room = {
  number: string;
  label?: string;
};

export type Poi = {
  id: string;
  name: string;
  kind: "building" | "poi" | "place";
  lat: number;
  lon: number;
  aliases?: string[];
  rooms?: Room[];
};

/** One OSM road/path way, as a polyline of real coordinates. */
export type Road = {
  id: string;
  tag: string;
  path: LatLng[];
};

export type CampusData = {
  center: LatLng;
  meta?: { generated?: string; source?: string };
  pois: Poi[];
  roads: Road[];
};
