# 🗺️ ASTU Campus Map & Navigation Web Application

An interactive, high-precision campus navigation web application for **Adama Science and Technology University (ASTU)** built with Next.js, TypeScript, Tailwind CSS, and Leaflet.

![ASTU Campus Map Banner](https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png)

---

## ✨ Features

- **🗺️ Interactive Satellite & Vector Maps**:
  - High-resolution Esri World Imagery satellite basemap with Voyager label overlays.
  - Interactive building polygons, custom markers, and popups with building metadata.

- **🚶‍♂️ Real Foot-Path Navigation & Turn-by-Turn Guidance**:
  - Real-time foot walking routing powered by OpenStreetMap OSRM network.
  - Synchronized turn-by-turn step instructions with interactive **Next** / **Previous** step controls and pulsating map camera tracking.
  - Accurate distance and estimated walking time calculations.

- **🔍 Smart Search Engine**:
  - Search by building code (e.g. `B7`, `B11`), full building name, department, or specific room names.
  - Prioritized search dropdown floating over map view with instant camera `flyTo` animation upon selection.

- **🏢 Floor-by-Floor Room Directory**:
  - Rich place inspection cards detailing floor numbers, room types, work activities, and technical equipment specs.
  - Building capacities, department leadership info, operating hours, and contact action buttons (call/email/website).

- **🎯 High-Accuracy GPS Tracking**:
  - One-tap live hardware GPS acquisition (`🎯`) with auto-fly camera re-centering.
  - Draggable blue location marker pin for custom start point positioning anywhere on campus.

- **📱 Google Maps-Inspired Responsive UI**:
  - Mobile collapsible bottom sheet (Peek & Full Detail modes).
  - Compact search bar layout tailored for both mobile devices and desktop screens.
  - Global `pointer` cursor interactions and custom thin scrollbars.

- **🛠️ Built-in Campus Map Digitizer (`/digitize`)**:
  - Canvas digitizer page for adding new campus nodes, connecting paths, and plotting building coordinates into `campus.json`.

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router & Turbopack)
- **Library**: React 19, TypeScript
- **Styling**: Tailwind CSS
- **Mapping**: [Leaflet](https://leafletjs.com/) & [React-Leaflet](https://react-leaflet.js.org/)
- **Routing Engine**: OSRM (Open Source Routing Machine) API & Dijkstra Shortest Path Engine
- **Icons**: Lucide React Icons

---

## 🚀 Getting Started

### Prerequisites
Make sure you have Node.js (v18 or higher) installed on your machine.

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/bilalshemsu1/ASTU-Map.git
   cd ASTU-Map
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open browser**:
   Navigate to [http://localhost:3000](http://localhost:3000) to view the live ASTU Campus Map.

---

## 📦 Production Build

To test or generate an optimized production build:

```bash
npm run build
npm run start
```

---

## 📁 Project Structure

```
ASTU-Map/
├── app/
│   ├── digitize/         # Map digitizer tool for path & building mapping
│   ├── globals.css       # Global styles, scrollbar customization & pointer cursors
│   ├── layout.tsx        # App layout wrapper
│   └── page.tsx          # Main campus map entry point
├── components/
│   ├── GoogleMapCanvas.tsx       # Leaflet map container component wrapper
│   ├── GoogleMapCanvasClient.tsx # Leaflet map client renderer (Markers, Polylines, ZoomControls)
│   └── GoogleMapsUI.tsx         # Floating Google Maps UI overlay (Search, Directions, Place Sheets)
├── lib/
│   ├── data/
│   │   └── campus.json   # ASTU campus buildings, room directories, and graph nodes
│   ├── types/
│   │   └── map.ts        # TypeScript interfaces for buildings, rooms, nodes, and routes
│   └── utils/
│       ├── graph.ts      # Haversine distance math & Dijkstra shortest path routing
│       ├── routing.ts    # OSRM walking network integration
│       └── search.ts     # Campus building & room fuzzy search engine
└── public/               # Static assets and icons
```

---

## 📄 License

Distributed under the MIT License. Built for **Addis Ababa Science and Technology University (ASTU)**.
