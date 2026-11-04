import { LatLng } from '../types/map';

/**
 * Strict boundary limits for ASTU (Adama Science and Technology University) Campus.
 * Prevents the map from panning away into the surrounding city or zooming out to regional scale.
 */
export const ASTU_CAMPUS_BOUNDS = {
  // Snug bounding box coordinates with a calibrated ~180-220m perimeter buffer
  southWest: { lat: 8.5550, lng: 39.2825 } as LatLng,
  northEast: { lat: 8.5720, lng: 39.2975 } as LatLng,

  // Leaflet format: [[southWestLat, southWestLng], [northEastLat, northEastLng]]
  leafletBounds: [
    [8.5550, 39.2825],
    [8.5720, 39.2975],
  ] as [[number, number], [number, number]],

  // True geographical center of the campus footprint
  center: { lat: 8.5638, lng: 39.2905 } as LatLng,
  leafletCenter: [8.5638, 39.2905] as [number, number],

  // Calibrated zoom bounds:
  // minZoom 16 ensures the campus fills the viewport without displaying miles of outside terrain
  // maxZoom 22 allows close-up inspection of doorways, ramps, and rooms
  minZoom: 16,
  maxZoom: 22,
  defaultZoom: 17,
  maxBoundsViscosity: 1.0, // Hard boundary wall: prevents panning outside campus
};
