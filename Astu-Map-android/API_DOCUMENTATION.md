# 📡 ASTU Campus Navigator — REST API Documentation

Comprehensive REST API documentation for the **Adama Science and Technology University (ASTU) Campus Navigator**.

This API allows mobile developers (Flutter, React Native, Kotlin, Swift) and third-party applications to query campus landmarks, search rooms and departments, compute turn-by-turn walking routes, and interact with the AI Campus Guide.

---

## 🌐 General API Information

- **Base URL (Local)**: `http://localhost:4000`
- **Base URL (Production)**: `https://<your-app>.vercel.app`
- **Data Format**: `application/json`
- **CORS**: Enabled globally (`Access-Control-Allow-Origin: *`) with pre-flight `OPTIONS` handling.
- **Performance**: Edge/Serverless-optimized. In-memory data graph with sub-30ms response times.
- **Authentication**: Public read-only endpoints require no API key.

---

## 📑 API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | [`/api`](#1-api-discovery--health-check) | API directory, status, and interactive documentation |
| `GET` | [`/api/campus`](#2-campus-data-sync) | Complete campus dataset for offline-first caching |
| `GET` | [`/api/buildings`](#3-list-buildings) | Filterable building directory |
| `GET` | [`/api/buildings/:id`](#4-building-details) | Single building inspection with room directory & operating hours |
| `GET` | [`/api/search`](#5-campus-search) | Ranked search by code, name, department, room, or alias |
| `GET` | [`/api/places/nearby`](#6-nearby-amenities) | Amenities sorted by walking distance from user coordinates |
| `POST` / `GET` | [`/api/route`](#7-turn-by-turn-walking-route) | Dijkstra shortest pathfinder with step-by-step guidance |
| `POST` | [`/api/chat`](#8-ai-campus-guide) | Groq LLaMA 3.3 70B AI assistant with navigation intent actions |

---

## 1. API Discovery & Health Check

### `GET /api`
Returns the status of the API, operational parameters, and a dynamic list of all available endpoints.

#### Example Request:
```bash
curl -X GET "https://<your-app>.vercel.app/api"
```

#### Example Response:
```json
{
  "name": "ASTU Campus Navigator API",
  "description": "REST API for Adama Science & Technology University (ASTU) campus navigation, place directory, routing, and AI guide.",
  "version": "1.0.0",
  "status": "operational",
  "baseUrl": "https://astu-map.vercel.app",
  "cors": {
    "enabled": true,
    "allowedOrigins": "*",
    "allowedMethods": ["GET", "POST", "OPTIONS"]
  },
  "endpoints": [ ... ]
}
```

---

## 2. Campus Data Sync

### `GET /api/campus`
Retrieves the full campus dataset (metadata, buildings, navigation nodes, and edges) to enable offline navigation and caching on mobile devices.

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `type` | `string` | No | Optional filter: `"buildings"`, `"graph"`, or `"paths"` to reduce payload. |

#### Example Request:
```bash
curl -X GET "https://<your-app>.vercel.app/api/campus"
```

#### Example Response:
```json
{
  "version": "1.0.0",
  "meta": {
    "name": "ASTU Campus Map",
    "center": { "lat": 8.5638, "lng": 39.2905 },
    "zoom": 17
  },
  "summary": {
    "buildingsCount": 25,
    "nodesCount": 363,
    "edgesCount": 491
  },
  "buildings": [ ... ],
  "nodes": [ ... ],
  "edges": [ ... ]
}
```

---

## 3. List Buildings

### `GET /api/buildings`
Returns all campus buildings with quick summary details and category statistics.

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `category` | `string` | No | Filter by: `academic`, `administrative`, `dormitory`, `dining`, `library`, `sports`, `other` |
| `q` | `string` | No | Text filter across name, code, department, aliases, and rooms |
| `open_now` | `boolean`| No | Pass `true` to filter only currently open facilities |

#### Example Request:
```bash
curl -X GET "https://<your-app>.vercel.app/api/buildings?category=academic&open_now=true"
```

#### Example Response:
```json
{
  "count": 9,
  "totalBuildings": 25,
  "categories": {
    "academic": 9,
    "administrative": 2,
    "dining": 1,
    "dormitory": 2,
    "library": 4,
    "sports": 3,
    "other": 4
  },
  "buildings": [
    {
      "id": "soeec",
      "code": "SOEEC",
      "name": "ASTU School of Electrical Engineering and Computing",
      "category": "academic",
      "aliases": ["Block 51", "Block 50", "Computing"],
      "center": { "lat": 8.5638, "lng": 39.2894 },
      "entranceNodeId": "n_soeec",
      "department": "School of Electrical Engineering and Computing",
      "hours": "Mon - Fri: 08:00 - 18:30",
      "isOpen": true,
      "roomCount": 14,
      "images": [ ... ]
    }
  ]
}
```

---

## 4. Building Details

### `GET /api/buildings/:id`
Retrieves comprehensive details for a specific building, including floor-by-floor room directories, equipment, contacts, entrance coordinates, and real-time operating hours status.

#### Path Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `string` | Yes | Building ID (e.g., `soeec`, `clib`, `students_cafe`) or code (e.g., `SOEEC`, `CLIB`, `SCAFE`). |

#### Example Request:
```bash
curl -X GET "https://<your-app>.vercel.app/api/buildings/soeec"
```

#### Example Response:
```json
{
  "success": true,
  "building": {
    "id": "soeec",
    "code": "SOEEC",
    "name": "ASTU School of Electrical Engineering and Computing",
    "category": "academic",
    "center": { "lat": 8.563803, "lng": 39.289464 },
    "entrance": {
      "id": "n_soeec",
      "lat": 8.563803,
      "lng": 39.289464
    },
    "operatingStatus": {
      "status": "open",
      "badgeLabel": "Open",
      "badgeDetail": "Normal campus hours",
      "scheduleSummary": "Mon - Fri • 8:00 AM – 6:00 PM"
    },
    "details": {
      "department": "School of Electrical Engineering and Computing",
      "email": "soeec@astu.edu.et",
      "phone": "+251 22 111 0400",
      "website": "https://www.astu.edu.et"
    },
    "roomsByFloor": {
      "0": [
        { "id": "soeec_g01", "name": "Dean's Office", "floor": 0, "workDescription": "Administration" }
      ],
      "1": [
        { "id": "soeec_101", "name": "Computer Networks Lab", "floor": 1, "equipment": ["Cisco Routers", "Switches"] }
      ]
    }
  }
}
```

---

## 5. Campus Search

### `GET /api/search`
Smart, weighted search engine that indexes building names, abbreviations (`B7`, `SOEEC`), departments, rooms, and aliases.

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `q` | `string` | Yes | Search query (e.g. `"library"`, `"cse"`, `"transcripts"`, `"b7"`). |
| `category` | `string` | No | Optional filter by building category. |
| `limit` | `number` | No | Max number of results (default: `15`, max: `50`). |

#### Example Request:
```bash
curl -X GET "https://<your-app>.vercel.app/api/search?q=library"
```

#### Example Response:
```json
{
  "query": "library",
  "count": 4,
  "results": [
    {
      "score": 85,
      "building": {
        "id": "central_library",
        "code": "CLIB",
        "name": "ASTU Central Library",
        "category": "library",
        "center": { "lat": 8.5641, "lng": 39.2921 },
        "entrance": { "lat": 8.56412, "lng": 39.29205 }
      },
      "matchingRoom": null
    },
    {
      "score": 80,
      "building": {
        "id": "pg_library",
        "code": "PGLIB",
        "name": "ASTU Postgraduate Library",
        "category": "library"
      },
      "matchingRoom": null
    }
  ]
}
```

---

## 6. Nearby Amenities

### `GET /api/places/nearby`
Finds campus buildings, study halls, or cafeterias nearest to the user's current GPS location, sorted in ascending order of distance.

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `lat` | `number` | Yes | User's latitude (e.g., `8.5638`). |
| `lng` | `number` | Yes | User's longitude (e.g., `39.2894`). |
| `radius` | `number` | No | Search radius in meters (default: `1000`). |
| `category` | `string` | No | Optional category filter (e.g., `dining`, `library`). |
| `limit` | `number` | No | Maximum results (default: `10`). |

#### Example Request:
```bash
curl -X GET "https://<your-app>.vercel.app/api/places/nearby?lat=8.5638&lng=39.2894&radius=300&category=dining"
```

#### Example Response:
```json
{
  "origin": { "lat": 8.5638, "lng": 39.2894 },
  "radiusMeters": 300,
  "count": 1,
  "places": [
    {
      "building": {
        "id": "students_cafe",
        "code": "SCAFE",
        "name": "Students Cafe",
        "category": "dining",
        "isOpen": true
      },
      "distanceMeters": 230,
      "distanceFormatted": "230 m",
      "estimatedMinutes": 3,
      "timeFormatted": "3 min"
    }
  ]
}
```

---

## 7. Turn-by-Turn Walking Route

### `POST /api/route` (or `GET /api/route`, `/api/directions`)
Calculates the shortest walkable pedestrian path using the ASTU internal campus graph via Dijkstra's algorithm. Provides road-snapping, polyline coordinates, and step-by-step turn guidance.

#### Request Body (`POST`):
```json
{
  "origin": { "lat": 8.559177, "lng": 39.285693 },
  "destination": { "buildingId": "soeec" },
  "accessible": false,
  "avoidStairs": false
}
```
*Note: `origin` and `destination` can be specified as:*
- Coordinates: `{ "lat": 8.5591, "lng": 39.2856 }`
- Building ID/Code: `{ "buildingId": "soeec" }` or `"soeec"`
- Node ID: `{ "nodeId": "n_soeec" }`

#### Fast GET Query Example:
```bash
curl -X GET "https://<your-app>.vercel.app/api/route?from=8.559177,39.285693&to=soeec"
```

#### Example Response:
```json
{
  "success": true,
  "summary": {
    "totalDistanceMeters": 804,
    "distanceFormatted": "804 m",
    "estimatedTimeMinutes": 11,
    "timeFormatted": "11 min",
    "waypointsCount": 16,
    "stepsCount": 11
  },
  "origin": {
    "label": "ASTU MAIN GATE (GATE1)",
    "coord": { "lat": 8.559177, "lng": 39.285693 }
  },
  "destination": {
    "label": "ASTU School of Electrical Engineering and Computing (SOEEC)",
    "coord": { "lat": 8.563803, "lng": 39.289464 }
  },
  "coordinates": [
    [8.559177, 39.285693],
    [8.559821, 39.286120],
    [8.563803, 39.289464]
  ],
  "geoJson": {
    "type": "LineString",
    "coordinates": [
      [39.285693, 8.559177],
      [39.286120, 8.559821],
      [39.289464, 8.563803]
    ]
  },
  "steps": [
    {
      "stepNumber": 1,
      "instruction": "Head straight for 189m",
      "distanceMeters": 189,
      "distanceFormatted": "189 m",
      "from": { "id": "user_start", "lat": 8.559177, "lng": 39.285693 },
      "to": { "id": "r_14", "lat": 8.560421, "lng": 39.286910 }
    },
    {
      "stepNumber": 11,
      "instruction": "Arrive at SOEEC Entrance",
      "distanceMeters": 15,
      "distanceFormatted": "15 m",
      "from": { "id": "r_18", "lat": 8.563721, "lng": 39.289410 },
      "to": { "id": "n_soeec", "lat": 8.563803, "lng": 39.289464 }
    }
  ]
}
```

---

## 8. AI Campus Guide

### `POST /api/chat`
Conversational AI guide backed by Groq LLaMA 3.3 70B (with offline campus fallback). Intelligently parses user intents and returns structured navigation actions (`type: "NAVIGATE"`) with exact destination entrance coordinates.

#### Request Body:
```json
{
  "message": "Where is SOEEC?",
  "userLocation": {
    "lat": 8.5591,
    "lng": 39.2856
  },
  "history": []
}
```

#### Example Response:
```json
{
  "reply": "I found **ASTU School of Electrical Engineering and Computing (SOEEC)** for you.\n\n**Department**: School of Electrical Engineering and Computing\n**Hours**: Mon - Fri: 08:00 - 18:30",
  "suggestedPlaces": [
    {
      "buildingId": "soeec",
      "buildingName": "ASTU School of Electrical Engineering and Computing",
      "buildingCode": "SOEEC",
      "reason": "Department of computing and electrical engineering"
    }
  ],
  "action": {
    "type": "NAVIGATE",
    "destination": {
      "buildingId": "soeec",
      "buildingName": "ASTU School of Electrical Engineering and Computing",
      "buildingCode": "SOEEC",
      "entrance": {
        "lat": 8.563803,
        "lng": 39.289464
      },
      "distanceMeters": 804,
      "distanceFormatted": "804 m"
    }
  },
  "isFallback": false
}
```

---

## 🛠️ Client Integration Examples

### Flutter (Dart) Example

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class AstuCampusApi {
  static const String baseUrl = 'https://<your-app>.vercel.app/api';

  /// Calculate route between user coordinates and target building
  static Future<Map<String, dynamic>> calculateRoute({
    required double userLat,
    required double userLng,
    required String destinationBuildingId,
  }) async {
    final uri = Uri.parse('$baseUrl/route');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'origin': {'lat': userLat, 'lng': userLng},
        'destination': {'buildingId': destinationBuildingId},
      }),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    } else {
      throw Exception('Failed to calculate route: ${response.body}');
    }
  }

  /// Ask the AI campus guide
  static Future<Map<String, dynamic>> askAiGuide(String message, [double? lat, double? lng]) async {
    final uri = Uri.parse('$baseUrl/chat');
    final response = await http.post(
      uri,
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'message': message,
        if (lat != null && lng != null) 'userLocation': {'lat': lat, 'lng': lng},
      }),
    );

    return jsonDecode(response.body);
  }
}
```

### React Native / TypeScript Example

```typescript
const BASE_URL = 'https://<your-app>.vercel.app/api';

export async function fetchCampusRoute(origin: { lat: number; lng: number }, destinationId: string) {
  const response = await fetch(`${BASE_URL}/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      origin,
      destination: { buildingId: destinationId },
    }),
  });

  if (!response.ok) {
    throw new Error(`Route error: ${response.statusText}`);
  }

  return response.json();
}
```
