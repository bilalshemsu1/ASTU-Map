'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Navigation,
  Footprints,
  Car,
  Bike,
  LocateFixed,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  DoorOpen,
  MapPin,
  ListOrdered,
  CheckCircle2,
  CornerUpRight,
  Clock,
  Mail,
  Phone,
  Globe,
  Building2,
  Check,
  User,
  Users,
  Wrench,
  Layers,
  Loader2,
} from 'lucide-react';
import { CampusData, Building, Room, PathNode, RouteResult, LatLng } from '../lib/types/map';
import { searchCampus, SearchResult } from '../lib/utils/search';
import { fetchRealWalkingRoute } from '../lib/utils/routing';
import { calculateHaversineDistance } from '../lib/utils/graph';
import GoogleMapCanvas from './GoogleMapCanvas';

interface GoogleMapsUIProps {
  campusData: CampusData;
}

export default function GoogleMapsUI({ campusData }: GoogleMapsUIProps) {
  // Map Type State (Esri World Imagery Satellite as primary default)
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('satellite');

  // UI Modes
  const [isDirectionsMode, setIsDirectionsMode] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(0);
  const [isStepsExpanded, setIsStepsExpanded] = useState<boolean>(false);

  // Selected Place Inspection State & Collapsible Bottom Sheet Mode
  const [selectedPlace, setSelectedPlace] = useState<Building | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isPlaceSheetExpanded, setIsPlaceSheetExpanded] = useState<boolean>(false);

  // Reset image index & collapse place sheet when selected place changes
  useEffect(() => {
    setActiveImageIndex(0);
    setIsPlaceSheetExpanded(false);
  }, [selectedPlace]);

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeInput, setActiveInput] = useState<'search' | 'start' | 'dest' | null>(null);

  // Routing State
  const [startNodeId, setStartNodeId] = useState<string>('n_gate');
  const [startLabel, setStartLabel] = useState<string>('Main Gate Entrance');
  const [startCoords, setStartCoords] = useState<LatLng>({
    lat: campusData.nodes[0].lat,
    lng: campusData.nodes[0].lng,
  });

  const [destBuilding, setDestBuilding] = useState<Building | null>(null);
  const [destRoom, setDestRoom] = useState<Room | undefined>(undefined);
  const [destLabel, setDestLabel] = useState<string>('');

  // Real Computed Route Result State
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // GPS Location State, Recenter Trigger & Feedback
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [liveUserLocation, setLiveUserLocation] = useState<LatLng | null>(null);
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  // Fetch Real Foot Walking Route
  useEffect(() => {
    if (!isDirectionsMode || !destBuilding) {
      setRouteResult(null);
      return;
    }

    const startPos = startCoords;
    const destPos = destBuilding.center;

    let isMounted = true;
    setIsLoadingRoute(true);

    fetchRealWalkingRoute(
      startPos,
      destPos,
      startNodeId,
      destBuilding.entranceNodeId,
      campusData
    ).then((res) => {
      if (isMounted) {
        setRouteResult(res);
        setIsLoadingRoute(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isDirectionsMode, startCoords, startNodeId, destBuilding, campusData]);

  // Handle Dragging Blue Pin on Map to update custom start position
  const handleUpdateLiveLocation = (coords: LatLng) => {
    setLiveUserLocation(coords);
    setStartCoords(coords);

    let closestNode = campusData.nodes[0];
    let minDist = Infinity;

    campusData.nodes.forEach((n) => {
      const d = calculateHaversineDistance(coords, n);
      if (d < minDist) {
        minDist = d;
        closestNode = n;
      }
    });

    setStartNodeId(closestNode.id);
    setStartLabel(`Custom Position (${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)})`);

    setLocationToast('📍 Start location pin moved!');
    setTimeout(() => setLocationToast(null), 3000);
  };

  // Handle Pure High-Accuracy Browser GPS Location
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    setIsLocating(true);
    setLocationToast('Acquiring your live GPS position...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const rawCoords = { lat: userLat, lng: userLng };
        const accuracy = Math.round(pos.coords.accuracy || 10);

        setIsLocating(false);

        setStartCoords(rawCoords);
        setLiveUserLocation(rawCoords);

        let closestNode = campusData.nodes[0];
        let minDist = Infinity;

        campusData.nodes.forEach((n) => {
          const d = calculateHaversineDistance(rawCoords, n);
          if (d < minDist) {
            minDist = d;
            closestNode = n;
          }
        });

        setStartNodeId(closestNode.id);
        setStartLabel(`Your Live GPS Location (${userLat.toFixed(4)}, ${userLng.toFixed(4)})`);
        setActiveInput(null);

        setRecenterTrigger((prev) => prev + 1);

        setLocationToast(`🎯 Live GPS Position Locked (±${accuracy}m accuracy)!`);
        setTimeout(() => setLocationToast(null), 4000);
      },
      (err) => {
        setIsLocating(false);
        setLocationToast(null);
        alert(`Could not get GPS location: ${err.message}`);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      }
    );
  };

  const handleSearchChange = (q: string, target: 'search' | 'start' | 'dest') => {
    setActiveInput(target);
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
    } else {
      setSearchResults(searchCampus(q, campusData));
    }
  };

  const handleSelectSearchResult = (res: SearchResult) => {
    if (activeInput === 'search') {
      setSelectedPlace(res.building);
      setDestBuilding(res.building);
      setDestRoom(res.matchingRoom);
      setDestLabel(
        res.matchingRoom ? `${res.building.code} — ${res.matchingRoom.name}` : res.building.name
      );
      setRecenterTrigger((prev) => prev + 1);
    } else if (activeInput === 'dest') {
      setDestBuilding(res.building);
      setDestRoom(res.matchingRoom);
      setDestLabel(
        res.matchingRoom ? `${res.building.code} — ${res.matchingRoom.name}` : res.building.name
      );
      setRecenterTrigger((prev) => prev + 1);
    } else if (activeInput === 'start') {
      setStartNodeId(res.building.entranceNodeId);
      setStartCoords(res.building.center);
      setLiveUserLocation(res.building.center);
      setStartLabel(
        res.matchingRoom ? `${res.building.code} - ${res.matchingRoom.name}` : res.building.name
      );
      setRecenterTrigger((prev) => prev + 1);
    }
    setActiveInput(null);
    setSearchQuery('');
  };

  const handleSelectLandmarkNode = (node: PathNode) => {
    if (activeInput === 'start') {
      const landmarkCoords = { lat: node.lat, lng: node.lng };
      setStartNodeId(node.id);
      setStartCoords(landmarkCoords);
      setLiveUserLocation(landmarkCoords);
      setStartLabel(node.label || `Node ${node.id}`);
      setRecenterTrigger((prev) => prev + 1);
    }
    setActiveInput(null);
    setSearchQuery('');
  };

  const handleSwapLocations = () => {
    if (!destBuilding) return;
    const oldStartCoords = startCoords;
    const oldStartId = startNodeId;
    const oldStartLabel = startLabel;

    setStartNodeId(destBuilding.entranceNodeId);
    setStartCoords(destBuilding.center);
    setLiveUserLocation(destBuilding.center);
    setStartLabel(destLabel);

    const prevStartBuilding = campusData.buildings.find((b) => b.entranceNodeId === oldStartId);
    if (prevStartBuilding) {
      setDestBuilding(prevStartBuilding);
      setDestRoom(undefined);
      setDestLabel(oldStartLabel);
    } else {
      const tempBuilding: Building = {
        id: `custom_${Date.now()}`,
        code: 'START',
        name: oldStartLabel,
        aliases: [],
        category: 'other',
        polygon: [],
        center: oldStartCoords,
        rooms: [],
        entranceNodeId: oldStartId,
      };
      setDestBuilding(tempBuilding);
      setDestLabel(oldStartLabel);
    }
  };

  const handleOpenDirectionsToPlace = (building: Building, room?: Room) => {
    setDestBuilding(building);
    setDestRoom(room);
    setDestLabel(room ? `${building.code} — ${room.name}` : building.name);
    setSelectedPlace(null);
    setIsDirectionsMode(true);
  };

  const handleStartNavigation = () => {
    if (!routeResult || routeResult.steps.length === 0) return;
    setIsNavigating(true);
    setActiveNodeIndex(0);
  };

  const handleStopNavigation = () => {
    setIsNavigating(false);
    setActiveNodeIndex(0);
  };

  const handleNextStep = () => {
    if (!routeResult) return;
    if (activeNodeIndex < routeResult.steps.length - 1) {
      setActiveNodeIndex((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (activeNodeIndex > 0) {
      setActiveNodeIndex((prev) => prev - 1);
    }
  };

  // Group rooms by Floor number
  const roomsByFloor = useMemo(() => {
    if (!selectedPlace) return new Map<number, Room[]>();
    const map = new Map<number, Room[]>();
    selectedPlace.rooms.forEach((r) => {
      const f = r.floor ?? 0;
      if (!map.has(f)) map.set(f, []);
      map.get(f)!.push(r);
    });
    return map;
  }, [selectedPlace]);

  const isArrived =
    isNavigating && routeResult && activeNodeIndex === routeResult.steps.length - 1;

  const currentNavNode =
    isNavigating && routeResult && routeResult.steps[activeNodeIndex]
      ? routeResult.steps[activeNodeIndex].fromNode
      : null;

  const currentInstruction = useMemo(() => {
    if (!routeResult) return '';
    if (isArrived) {
      return `Arrived at destination: ${destLabel}!`;
    }
    const matchingStep = routeResult.steps[activeNodeIndex];
    return matchingStep ? matchingStep.instruction : `Heading towards ${destLabel}`;
  }, [routeResult, activeNodeIndex, isArrived, destLabel]);

  // Sliding Carousel Image Navigation
  const placeImages = selectedPlace?.details?.images || [];
  const handleNextImage = () => {
    if (placeImages.length > 0) {
      setActiveImageIndex((prev) => (prev + 1) % placeImages.length);
    }
  };
  const handlePrevImage = () => {
    if (placeImages.length > 0) {
      setActiveImageIndex((prev) => (prev - 1 + placeImages.length) % placeImages.length);
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-100 font-sans text-slate-800">
      {/* Fullscreen Interactive Canvas */}
      <GoogleMapCanvas
        campusData={campusData}
        selectedBuilding={selectedPlace}
        onSelectBuilding={(b) => {
          setSelectedPlace(b);
          setRecenterTrigger((prev) => prev + 1);
          if (isDirectionsMode) {
            setDestBuilding(b);
            setDestRoom(undefined);
            setDestLabel(b.name);
          }
        }}
        routeResult={routeResult}
        startNodeId={startNodeId}
        targetNodeId={destBuilding?.entranceNodeId}
        mapType={mapType}
        currentNavNode={currentNavNode}
        liveUserLocation={liveUserLocation}
        onUpdateLiveLocation={handleUpdateLiveLocation}
        recenterTrigger={recenterTrigger}
      />

      {/* GPS LOCATION TOAST NOTIFICATION BANNER */}
      {locationToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 bg-gray-900/95 backdrop-blur-md text-white text-xs font-bold rounded-full shadow-2xl flex items-center gap-2 border border-white/20 transition-all animate-bounce max-w-[90vw]">
          {isLocating ? <Loader2 className="w-4 h-4 animate-spin text-blue-400 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
          <span className="truncate">{locationToast}</span>
        </div>
      )}

      {/* TOP FLOATING SEARCH BAR & DROPDOWN RESULTS (HIGHEST PRIORITY Z-INDEX z-40) */}
      {!isNavigating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-40 w-[calc(100vw-1.5rem)] max-w-[420px] md:w-[420px] pointer-events-auto">
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden">
            {!isDirectionsMode ? (
              <div className="flex items-center px-3.5 py-2 md:px-4 md:py-2.5 gap-2.5">
                <Search className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Search ASTU buildings, rooms..."
                  value={activeInput === 'search' ? searchQuery : ''}
                  onFocus={() => setActiveInput('search')}
                  onChange={(e) => handleSearchChange(e.target.value, 'search')}
                  className="w-full outline-none text-xs md:text-sm text-gray-800 placeholder-gray-500 bg-transparent font-medium py-1 min-w-0"
                />
                <button
                  onClick={() => setIsDirectionsMode(true)}
                  className="p-2 md:p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow flex-shrink-0 cursor-pointer"
                  title="Get Directions"
                >
                  <CornerUpRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center">
                      G
                    </span>
                    <span className="font-bold text-gray-800 text-xs">ASTU Walking Directions</span>
                  </div>
                  <button
                    onClick={() => {
                      setIsDirectionsMode(false);
                      setRouteResult(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 p-0.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-around border-b border-gray-100 pb-2 text-[11px] font-medium text-gray-600">
                  <button className="flex items-center gap-1.5 text-blue-600 border-b-2 border-blue-600 pb-1 font-bold cursor-pointer">
                    <Footprints className="w-3.5 h-3.5" /> Walk
                  </button>
                  <button className="flex items-center gap-1.5 opacity-40 cursor-not-allowed">
                    <Car className="w-3.5 h-3.5" /> Drive
                  </button>
                  <button className="flex items-center gap-1.5 opacity-40 cursor-not-allowed">
                    <Bike className="w-3.5 h-3.5" /> Bike
                  </button>
                </div>

                <div className="flex items-center gap-2 relative">
                  <div className="flex flex-col items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white shadow" />
                    <span className="w-0.5 h-5 bg-gray-300" />
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 border-2 border-white shadow" />
                  </div>

                  <div className="flex-1 flex flex-col gap-1.5 min-w-0">
                    <input
                      type="text"
                      placeholder="Choose starting point..."
                      value={activeInput === 'start' ? searchQuery : startLabel}
                      onFocus={() => {
                        setActiveInput('start');
                        setSearchQuery('');
                      }}
                      onChange={(e) => handleSearchChange(e.target.value, 'start')}
                      className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-all truncate"
                    />
                    <input
                      type="text"
                      placeholder="Choose destination..."
                      value={activeInput === 'dest' ? searchQuery : destLabel}
                      onFocus={() => {
                        setActiveInput('dest');
                        setSearchQuery('');
                      }}
                      onChange={(e) => handleSearchChange(e.target.value, 'dest')}
                      className="w-full bg-gray-100 hover:bg-gray-200 focus:bg-white focus:ring-2 focus:ring-blue-500 rounded-lg px-2.5 py-1.5 text-xs font-medium outline-none transition-all truncate"
                    />
                  </div>

                  <button
                    onClick={handleSwapLocations}
                    className="p-1.5 hover:bg-gray-100 rounded-full text-gray-500 hover:text-gray-800 transition-colors cursor-pointer flex-shrink-0"
                    title="Swap Origin and Destination"
                  >
                    <ArrowUpDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* Dropdown Results */}
            {activeInput && (
              <div className="max-h-64 overflow-y-auto custom-scrollbar divide-y divide-gray-100 border-t border-gray-100 bg-white shadow-2xl">
                {activeInput === 'start' && (
                  <div
                    onClick={handleUseCurrentLocation}
                    className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs cursor-pointer flex items-center gap-2 border-b border-blue-100"
                  >
                    {isLocating ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600 flex-shrink-0" />
                    ) : (
                      <LocateFixed className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    )}
                    <span className="truncate">{isLocating ? 'Locating your position...' : 'Use My Live GPS Location'}</span>
                  </div>
                )}

                {activeInput === 'start' && !searchQuery && (
                  <div className="p-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400 px-2 py-1">
                      Campus Landmarks & Entrance Gates
                    </p>
                    {campusData.nodes
                      .filter((n) => n.label)
                      .map((n) => (
                        <div
                          key={n.id}
                          onClick={() => handleSelectLandmarkNode(n)}
                          className="px-3 py-2 hover:bg-blue-50 text-xs cursor-pointer flex items-center justify-between text-gray-700"
                        >
                          <span className="flex items-center gap-1.5 truncate">
                            <MapPin className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /> {n.label}
                          </span>
                          <span className="text-[10px] text-gray-400 flex-shrink-0">Landmark</span>
                        </div>
                      ))}
                  </div>
                )}

                {searchResults.map((res, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSearchResult(res)}
                    className="p-2.5 hover:bg-blue-50 cursor-pointer transition-colors flex items-center gap-3"
                  >
                    {res.building.details?.images?.[0] ? (
                      <img
                        src={res.building.details.images[0]}
                        alt={res.building.name}
                        className="w-10 h-10 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {res.building.code}
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 text-xs truncate">{res.building.name}</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold ml-1 flex-shrink-0">
                          {res.building.code}
                        </span>
                      </div>
                      {res.matchingRoom ? (
                        <p className="text-[11px] text-emerald-600 font-medium mt-0.5 flex items-center gap-1 truncate">
                          <DoorOpen className="w-3 h-3 flex-shrink-0" /> Room: {res.matchingRoom.name}
                        </p>
                      ) : (
                        <p className="text-[10px] text-gray-400 truncate mt-0.5">
                          {res.building.details?.department || res.building.category}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* RICH PLACE DETAILS SHEET */}
      {selectedPlace && !isNavigating && !isDirectionsMode && (
        <div className="absolute bottom-0 left-0 right-0 md:top-[92px] md:left-4 md:right-auto md:bottom-auto z-20 w-full md:w-[420px] pointer-events-auto transition-all duration-300">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300">
            
            {/* Top Drag Handle Bar & Collapsible Header */}
            <div
              onClick={() => setIsPlaceSheetExpanded(!isPlaceSheetExpanded)}
              className="w-full pt-2 pb-1 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-100 md:hidden"
            >
              <div className="w-12 h-1 bg-gray-300 hover:bg-blue-500 rounded-full mb-1.5 transition-colors" />
              <div className="flex items-center gap-1 text-[11px] font-bold text-blue-600">
                <span>{isPlaceSheetExpanded ? 'Tap to Collapse' : 'Tap to Expand Full Details'}</span>
                {isPlaceSheetExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
              </div>
            </div>

            {/* PEEK COMPACT HEADER */}
            <div className="p-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2.5 min-w-0">
                {placeImages[0] && (
                  <img
                    src={placeImages[0]}
                    alt={selectedPlace.name}
                    className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-gray-200"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-extrabold uppercase text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                      {selectedPlace.code}
                    </span>
                    <span className="text-[10px] font-bold text-gray-400 uppercase">
                      {selectedPlace.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-xs text-gray-900 truncate mt-0.5">
                    {selectedPlace.name}
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                <button
                  onClick={() => handleOpenDirectionsToPlace(selectedPlace)}
                  className="px-2.5 py-1.5 bg-[#1a73e8] hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow flex items-center gap-1 transition-all cursor-pointer"
                >
                  <Navigation className="w-3.5 h-3.5 fill-white" />
                  <span>Directions</span>
                </button>
                <button
                  onClick={() => setSelectedPlace(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* EXPANDABLE BODY PANEL */}
            <div
              className={`flex-col overflow-y-auto custom-scrollbar transition-all duration-300 ${
                isPlaceSheetExpanded
                  ? 'flex max-h-[70vh] md:max-h-[calc(100vh-180px)]'
                  : 'hidden md:flex md:max-h-[calc(100vh-180px)]'
              }`}
            >
              {/* Sliding Image Carousel Header */}
              {placeImages.length > 0 && (
                <div className="relative h-48 bg-slate-900 overflow-hidden flex-shrink-0 group">
                  <img
                    src={placeImages[activeImageIndex]}
                    alt={selectedPlace.name}
                    className="w-full h-full object-cover transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                  {placeImages.length > 1 && (
                    <>
                      <button
                        onClick={handlePrevImage}
                        className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow z-10 cursor-pointer"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={handleNextImage}
                        className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition-colors shadow z-10 cursor-pointer"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/60 backdrop-blur-md rounded-md text-[10px] font-bold text-white z-10">
                        {activeImageIndex + 1} / {placeImages.length}
                      </div>
                    </>
                  )}

                  <div className="absolute bottom-3 left-4 right-4 text-white z-10">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-blue-600/90 backdrop-blur-md rounded-md text-[10px] font-extrabold uppercase tracking-wider">
                        {selectedPlace.category}
                      </span>
                      {selectedPlace.details?.verified && (
                        <span className="px-2.5 py-0.5 bg-emerald-500/90 backdrop-blur-md rounded-md text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Verified ASTU
                        </span>
                      )}
                    </div>
                    <h2 className="font-black text-lg leading-tight truncate">
                      {selectedPlace.name}
                    </h2>
                  </div>
                </div>
              )}

              {/* Scrollable Content Body */}
              <div className="p-4 flex flex-col gap-4">
                {/* Quick Action Contact Bar */}
                <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
                  <button
                    onClick={() => handleOpenDirectionsToPlace(selectedPlace)}
                    className="flex-1 py-2.5 px-4 bg-[#1a73e8] hover:bg-blue-700 text-white font-extrabold text-xs rounded-lg shadow flex items-center justify-center gap-2 transition-all active:scale-95 cursor-pointer"
                  >
                    <Navigation className="w-4 h-4 fill-white" />
                    <span>Directions</span>
                  </button>
                  {selectedPlace.details?.phone && (
                    <a
                      href={`tel:${selectedPlace.details.phone}`}
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
                      title="Call Office"
                    >
                      <Phone className="w-4 h-4" />
                    </a>
                  )}
                  {selectedPlace.details?.email && (
                    <a
                      href={`mailto:${selectedPlace.details.email}`}
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
                      title="Send Email"
                    >
                      <Mail className="w-4 h-4" />
                    </a>
                  )}
                  {selectedPlace.details?.website && (
                    <a
                      href={selectedPlace.details.website}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors cursor-pointer"
                      title="Visit Department Website"
                    >
                      <Globe className="w-4 h-4" />
                    </a>
                  )}
                </div>

                {/* Code & Capacity Metrics */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-600" />
                    <div>
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Building Code</span>
                      <strong className="text-gray-900 font-extrabold">{selectedPlace.code}</strong>
                    </div>
                  </div>

                  {selectedPlace.details?.totalCapacity && (
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="text-gray-400 block text-[10px] font-bold uppercase">Capacity</span>
                        <strong className="text-gray-900 font-extrabold">{selectedPlace.details.totalCapacity} people</strong>
                      </div>
                    </div>
                  )}
                </div>

                {selectedPlace.details?.headOfDepartment && (
                  <div className="flex items-center gap-2 text-xs text-gray-700 bg-blue-50/60 p-2.5 rounded-lg border border-blue-100">
                    <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
                    <span>Leadership: <strong className="text-gray-900">{selectedPlace.details.headOfDepartment}</strong></span>
                  </div>
                )}

                {/* Long Description */}
                {selectedPlace.details?.description && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                      About this Building
                    </h4>
                    <p className="text-xs text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                      {selectedPlace.details.description}
                    </p>
                  </div>
                )}

                {/* Operating Hours */}
                {selectedPlace.details?.hours && (
                  <div className="flex items-center gap-2.5 text-xs text-gray-700 bg-emerald-50 text-emerald-800 p-2.5 rounded-xl font-medium border border-emerald-100">
                    <Clock className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{selectedPlace.details.hours}</span>
                  </div>
                )}

                {/* Features & Equipment Specifications */}
                {selectedPlace.details?.features && selectedPlace.details.features.length > 0 && (
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-2">
                      Building Facilities & Tech Specifications
                    </h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {selectedPlace.details.features.map((feat, idx) => (
                        <div key={idx} className="flex items-center gap-1.5 text-gray-700 font-medium bg-gray-50 p-2 rounded-lg border border-gray-100">
                          <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="truncate">{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FLOOR-BY-FLOOR ORGANIZED ROOMS & WORK ACTIVITIES */}
                {roomsByFloor.size > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2.5 border-b border-gray-100 pb-2">
                      <h4 className="text-xs font-black uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-blue-600" />
                        <span>Floor-by-Floor Directory</span>
                      </h4>
                      <span className="text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-0.5 rounded-full">
                        {selectedPlace.rooms.length} Rooms Listed
                      </span>
                    </div>

                    <div className="flex flex-col gap-3">
                      {Array.from(roomsByFloor.entries())
                        .sort(([fA], [fB]) => fA - fB)
                        .map(([floorNum, rooms]) => (
                          <div key={floorNum} className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-gray-900 text-white rounded text-[10px] font-black uppercase">
                                {floorNum === 0 ? 'Ground Floor (G)' : `Floor ${floorNum}`}
                              </span>
                              <span className="text-xs text-gray-400 font-medium">
                                ({rooms.length} room{rooms.length > 1 ? 's' : ''})
                              </span>
                            </div>

                            <div className="flex flex-col gap-2 pl-1">
                              {rooms.map((room) => (
                                <div
                                  key={room.id}
                                  className="p-2.5 bg-gray-50 hover:bg-blue-50/60 rounded-xl border border-gray-200 transition-colors flex flex-col gap-1.5"
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <DoorOpen className="w-4 h-4 text-blue-600 flex-shrink-0" />
                                        <span className="font-bold text-gray-900 text-xs">{room.name}</span>
                                      </div>
                                      {room.type && (
                                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded mt-1 inline-block">
                                          {room.type}
                                        </span>
                                      )}
                                    </div>

                                    <button
                                      onClick={() => handleOpenDirectionsToPlace(selectedPlace, room)}
                                      className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] rounded-md transition-colors shadow flex items-center gap-1 flex-shrink-0 cursor-pointer"
                                    >
                                      <Navigation className="w-3 h-3 fill-white" />
                                      <span>Directions</span>
                                    </button>
                                  </div>

                                  {room.workDescription && (
                                    <p className="text-[11px] text-gray-600 leading-relaxed bg-white p-2 rounded-lg border border-gray-100">
                                      <strong className="text-gray-800">Work & Activity: </strong>
                                      {room.workDescription}
                                    </p>
                                  )}

                                  {room.equipment && room.equipment.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                      <span className="text-[10px] text-gray-400 font-bold flex items-center gap-0.5">
                                        <Wrench className="w-3 h-3 text-amber-500" /> Equipment:
                                      </span>
                                      {room.equipment.map((eq, eqIdx) => (
                                        <span
                                          key={eqIdx}
                                          className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-medium"
                                        >
                                          {eq}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM SHEET ROUTE SUMMARY */}
      {!isNavigating && isDirectionsMode && routeResult && (
        <div className="absolute bottom-0 left-0 right-0 md:left-4 md:right-auto md:bottom-4 z-20 w-full md:w-[420px] pointer-events-auto transition-all duration-300">
          <div className="bg-white rounded-t-2xl md:rounded-2xl shadow-xl border border-gray-200 p-4 flex flex-col gap-3">
            <div
              onClick={() => setIsStepsExpanded(!isStepsExpanded)}
              className="w-12 h-1 bg-gray-300 hover:bg-blue-500 rounded-full mx-auto cursor-pointer transition-colors"
              title="Click to toggle steps"
            />

            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-emerald-600">
                    {routeResult.estimatedTimeMinutes} min
                  </span>
                  <span className="text-sm font-bold text-gray-500">
                    ({routeResult.totalDistanceMeters} m)
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">
                  Fastest foot path • ASTU Campus
                </div>
              </div>

              <button
                onClick={handleStartNavigation}
                className="px-6 py-2.5 bg-[#1a73e8] hover:bg-blue-700 text-white font-black text-sm rounded-lg shadow flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
              >
                <Navigation className="w-4 h-4 fill-white" />
                <span>Start</span>
              </button>
            </div>

            <div className="border-t border-gray-100 pt-2.5">
              <button
                onClick={() => setIsStepsExpanded(!isStepsExpanded)}
                className={`w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  isStepsExpanded
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <ListOrdered className="w-4 h-4 text-blue-600" />
                  <span>
                    {isStepsExpanded ? 'Turn-by-turn Directions' : `View ${routeResult.steps.length} Route Steps`}
                  </span>
                </div>
                <span className="flex items-center gap-1 font-extrabold">
                  {isStepsExpanded ? (
                    <>Hide <ChevronUp className="w-4 h-4" /></>
                  ) : (
                    <>View <ChevronDown className="w-4 h-4" /></>
                  )}
                </span>
              </button>

              {isStepsExpanded && (
                <div className="max-h-56 overflow-y-auto custom-scrollbar flex flex-col gap-2 mt-2.5 pr-1 border-t border-gray-100 pt-2.5">
                  {routeResult.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2.5 text-xs text-gray-700 bg-gray-50 p-2 rounded-lg border border-gray-100"
                    >
                      <span className="w-5 h-5 rounded-md bg-blue-600 text-white font-bold text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        {idx + 1}
                      </span>
                      <div className="flex-1">
                        <p className="font-bold text-gray-900">{step.instruction}</p>
                        <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                          {step.distanceMeters} meters
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACTIVE NAVIGATION GUIDANCE BAR */}
      {isNavigating && routeResult && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-11/12 max-w-lg pointer-events-auto">
          <div
            className={`rounded-2xl shadow-xl p-4 flex flex-col gap-2.5 text-white border transition-colors ${
              isArrived ? 'bg-emerald-600 border-emerald-500' : 'bg-[#1a73e8] border-blue-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold shadow-inner">
                  {isArrived ? (
                    <CheckCircle2 className="w-6 h-6 text-white" />
                  ) : (
                    <Footprints className="w-6 h-6 text-white" />
                  )}
                </span>
                <div>
                  <h3 className="font-extrabold text-sm leading-tight">
                    {currentInstruction}
                  </h3>
                  <p className="text-[11px] text-blue-100 font-medium mt-0.5">
                    {isArrived
                      ? 'You have reached your target room / building'
                      : `Step ${activeNodeIndex + 1} of ${routeResult.steps.length}`}
                  </p>
                </div>
              </div>

              <button
                onClick={handleStopNavigation}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-sm flex items-center justify-center transition-colors shadow cursor-pointer"
                title="Stop / Close Direction Mode"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between border-t border-white/20 pt-2 text-xs font-bold">
              <button
                onClick={handlePrevStep}
                disabled={activeNodeIndex === 0}
                className="px-3.5 py-1.5 bg-white/20 hover:bg-white/30 disabled:opacity-40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Previous
              </button>

              <span className="text-blue-100 font-medium">
                {isArrived
                  ? 'Destination Reached'
                  : `Step ${activeNodeIndex + 1} / ${routeResult.steps.length}`}
              </span>

              <button
                onClick={handleNextStep}
                disabled={activeNodeIndex === routeResult.steps.length - 1}
                className="px-4 py-1.5 bg-white text-blue-700 hover:bg-blue-50 disabled:opacity-40 rounded-lg transition-colors font-extrabold shadow flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Target GPS Button & Map Type Toggle Switch with z-[1000] */}
      <div
        style={{ zIndex: 1000 }}
        className="absolute bottom-28 md:bottom-6 right-4 md:right-6 flex flex-col gap-2 pointer-events-auto"
      >
        <button
          onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
          className="w-11 h-11 bg-white hover:bg-gray-100 text-gray-700 rounded-xl shadow-xl border border-gray-200 flex items-center justify-center transition-all cursor-pointer"
          title={`Switch to ${mapType === 'roadmap' ? 'Satellite' : 'Default Map'} View`}
        >
          <Layers className="w-5 h-5 text-blue-600" />
        </button>

        <button
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className={`w-11 h-11 bg-white hover:bg-gray-100 text-blue-600 rounded-xl shadow-xl border border-gray-200 flex items-center justify-center transition-all cursor-pointer ${
            isLocating ? 'ring-4 ring-blue-400/50 cursor-wait' : ''
          }`}
          title="Re-center on My Live Location"
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : (
            <LocateFixed className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
