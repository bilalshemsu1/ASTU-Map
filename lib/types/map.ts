export interface LatLng {
  lat: number;
  lng: number;
}

export interface Room {
  id: string;
  name: string;
  floor: number; // e.g. 0 for Ground, 1 for 1st Floor
  aliases?: string[];
  capacity?: number;
  type?: string;
  workDescription?: string; // e.g. "Transcripts, Student ID printing, Course drop/add"
  equipment?: string[]; // e.g. ["Oscilloscopes", "FPGA Boards", "3D Printers"]
}

export interface PlaceDetails {
  images?: string[]; // Array of image URLs for sliding carousel
  description?: string; // In-depth long description
  history?: string;
  email?: string;
  phone?: string;
  website?: string;
  hours?: string;
  features?: string[];
  department?: string;
  headOfDepartment?: string;
  totalCapacity?: number;
  verified?: boolean;
}

export interface Building {
  id: string;
  name: string;
  code: string;
  aliases: string[];
  category: 'academic' | 'administrative' | 'dormitory' | 'dining' | 'library' | 'sports' | 'other';
  polygon: LatLng[];
  center: LatLng;
  rooms: Room[];
  entranceNodeId: string;
  details?: PlaceDetails;
}

export interface PathNode {
  id: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface PathEdge {
  id: string;
  source: string;
  target: string;
  weight?: number;
}

export interface CampusData {
  meta: {
    name: string;
    center: LatLng;
    zoom: number;
  };
  buildings: Building[];
  nodes: PathNode[];
  edges: PathEdge[];
}

export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  fromNode: PathNode;
  toNode: PathNode;
}

export interface RouteResult {
  path: PathNode[];
  totalDistanceMeters: number;
  estimatedTimeMinutes: number;
  steps: RouteStep[];
}
