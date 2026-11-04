'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Share2,
  Sparkles,
  Play,
  Pause,
  FastForward,
  RotateCcw,
  Volume2,
  VolumeX,
  Radio,
  Coffee,
  BookOpen,
  GraduationCap,
  Accessibility,
} from 'lucide-react';
import { CampusData, Building, Room, PathNode, RouteResult, LatLng } from '../lib/types/map';
import { searchCampus, SearchResult } from '../lib/utils/search';
import { fetchRealWalkingRoute } from '../lib/utils/routing';
import { calculateHaversineDistance, calculateBearing, formatDistance, formatTime } from '../lib/utils/graph';
import GoogleMapCanvas from './GoogleMapCanvas';
import AIAssistantModal from './AIAssistantModal';

interface GoogleMapsUIProps {
  campusData: CampusData;
}

const CAMPUS_CATEGORIES = [
  { id: 'dining', label: 'Cafeterias', icon: Coffee, color: 'text-amber-800 bg-amber-50 hover:bg-amber-100 border-amber-300' },
  { id: 'library', label: 'Libraries', icon: BookOpen, color: 'text-blue-800 bg-blue-50 hover:bg-blue-100 border-blue-300' },
  { id: 'administrative', label: 'Admin & Services', icon: Building2, color: 'text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border-indigo-300' },
  { id: 'academic', label: 'Faculties & Labs', icon: GraduationCap, color: 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border-emerald-300' },
  { id: 'dormitory', label: 'Dormitories', icon: DoorOpen, color: 'text-purple-800 bg-purple-50 hover:bg-purple-100 border-purple-300' },
  { id: 'sports', label: 'Sports', icon: Footprints, color: 'text-orange-800 bg-orange-50 hover:bg-orange-100 border-orange-300' },
];

export default function GoogleMapsUI({ campusData }: GoogleMapsUIProps) {
  // Map Type State (Esri World Imagery Satellite as primary default)
  const [mapType, setMapType] = useState<'roadmap' | 'satellite'>('satellite');

  // UI Modes
  const [isDirectionsMode, setIsDirectionsMode] = useState<boolean>(false);
  const [isNavigating, setIsNavigating] = useState<boolean>(false);
  const [activeNodeIndex, setActiveNodeIndex] = useState<number>(0);
  const [isStepsExpanded, setIsStepsExpanded] = useState<boolean>(false);
  const [isAIAssistantOpen, setIsAIAssistantOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isAccessibleMode, setIsAccessibleMode] = useState<boolean>(false);

  // Selected Place Inspection State & Collapsible Bottom Sheet Mode
  const [selectedPlace, setSelectedPlace] = useState<Building | null>(null);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [isPlaceSheetExpanded, setIsPlaceSheetExpanded] = useState<boolean>(false);

  // Reset image index & collapse place sheet when selected place changes
  useEffect(() => {
    setActiveImageIndex(0);
    setIsPlaceSheetExpanded(false);
  }, [selectedPlace]);

  // Handle URL Location Deep Linking (?place=building_id)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const placeId = params.get('place') || params.get('building');
    if (placeId) {
      const targetBuilding = campusData.buildings.find(
        (b) =>
          b.id.toLowerCase() === placeId.toLowerCase() ||
          b.code.toLowerCase() === placeId.toLowerCase()
      );
      if (targetBuilding) {
        setSelectedPlace(targetBuilding);
        setRecenterTrigger((prev) => prev + 1);
        setLocationToast(`Loaded shared location: ${targetBuilding.name}`);
        setTimeout(() => setLocationToast(null), 4000);
      }
    }
  }, [campusData]);

  // Share Place Handler via Web Share API or Clipboard Link Copy
  const handleSharePlace = (building: Building) => {
    if (typeof window === 'undefined') return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?place=${building.id}`;
    const shareData = {
      title: `${building.name} | ASTU Campus Map`,
      text: `Check out ${building.name} on the Adama Science & Technology University (ASTU) Campus Map!`,
      url: shareUrl,
    };

    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share(shareData).catch(() => {
        navigator.clipboard?.writeText(shareUrl);
        setLocationToast('Location link copied to clipboard');
        setTimeout(() => setLocationToast(null), 3500);
      });
    } else {
      navigator.clipboard?.writeText(shareUrl);
      setLocationToast('Location link copied to clipboard');
      setTimeout(() => setLocationToast(null), 3500);
    }
  };

  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeInput, setActiveInput] = useState<'search' | 'start' | 'dest' | null>(null);

  // Routing State
  const mainGateNode = campusData.nodes.find((n) => n.id === 'n_main_gate') || campusData.nodes[0];
  const [startNodeId, setStartNodeId] = useState<string>(mainGateNode.id);
  const [startLabel, setStartLabel] = useState<string>('ASTU MAIN GATE');
  const [startCoords, setStartCoords] = useState<LatLng>({
    lat: mainGateNode.lat,
    lng: mainGateNode.lng,
  });

  const [destBuilding, setDestBuilding] = useState<Building | null>(null);
  const [destRoom, setDestRoom] = useState<Room | undefined>(undefined);
  const [destLabel, setDestLabel] = useState<string>('');

  // Real Computed Route Result State
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState<boolean>(false);

  // GPS Location State, Recenter Trigger & Feedback
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isLiveTracking, setIsLiveTracking] = useState<boolean>(false);
  const [liveUserLocation, setLiveUserLocation] = useState<LatLng | null>(null);
  const [liveLocationAccuracyMeters, setLiveLocationAccuracyMeters] = useState<number | null>(null);
  const [userHeading, setUserHeading] = useState<number | null>(null);
  const [followUser, setFollowUser] = useState<boolean>(true);
  const [recenterTrigger, setRecenterTrigger] = useState<number>(0);
  const [locationToast, setLocationToast] = useState<string | null>(null);

  // Live Walk Simulation State
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [isSimulationPaused, setIsSimulationPaused] = useState<boolean>(false);
  const [simulationSpeed, setSimulationSpeed] = useState<number>(1); // 1x, 2x, 4x
  const [isVoiceGuidance, setIsVoiceGuidance] = useState<boolean>(true);

  const locationWatchIdRef = useRef<number | null>(null);
  const hasReceivedGpsFixRef = useRef<boolean>(false);
  const simTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const simStateRef = useRef<{ segmentIdx: number; t: number }>({ segmentIdx: 0, t: 0 });
  const prevGpsCoordsRef = useRef<LatLng | null>(null);
  const isRecalculatingRef = useRef<boolean>(false);
  const lastSpokenIndexRef = useRef<number | null>(null);

  // Spoken voice guidance helper using Web Speech API
  const speakInstruction = (text: string) => {
    if (!isVoiceGuidance || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/[—–-]/g, ' ')
        .replace(/\bASTU\b/g, 'A S T U')
        .replace(/\s+/g, ' ')
        .trim();
      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    } catch {
      // Audio speech graceful fallback
    }
  };

  // Stop simulated walk
  const stopSimulation = () => {
    if (simTimerRef.current) {
      clearInterval(simTimerRef.current);
      simTimerRef.current = null;
    }
    setIsSimulating(false);
    setIsSimulationPaused(false);
  };

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
      campusData,
      { wheelchairAccessible: isAccessibleMode }
    ).then((res) => {
      if (isMounted) {
        setRouteResult(res);
        setIsLoadingRoute(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isDirectionsMode, startCoords, startNodeId, destBuilding, campusData, isAccessibleMode]);

  const stopLiveLocationTracking = (silent = false) => {
    if (locationWatchIdRef.current !== null && typeof navigator !== 'undefined') {
      navigator.geolocation.clearWatch(locationWatchIdRef.current);
      locationWatchIdRef.current = null;
    }
    setIsLiveTracking(false);
    setIsLocating(false);

    if (!silent) {
      setLocationToast('Live GPS tracking paused');
      setTimeout(() => setLocationToast(null), 2500);
    }
  };

  // Stop tracking and simulation on unmount
  useEffect(() => {
    return () => {
      stopLiveLocationTracking(true);
      stopSimulation();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Handle Dragging Blue Pin on Map to update custom start position
  const handleUpdateLiveLocation = (coords: LatLng) => {
    stopLiveLocationTracking(true);
    stopSimulation();
    setLiveUserLocation(coords);
    setLiveLocationAccuracyMeters(null);
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

    setLocationToast('Start location pin moved');
    setTimeout(() => setLocationToast(null), 3000);
  };

  // Start / toggle continuous high-accuracy browser GPS subscription for live navigation
  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.');
      return;
    }

    // If already tracking, tap re-centers map camera on live position
    if (locationWatchIdRef.current !== null && liveUserLocation) {
      setRecenterTrigger((prev) => prev + 1);
      setLocationToast('Centered on your live GPS position');
      setTimeout(() => setLocationToast(null), 2500);
      return;
    }

    // Stop any active simulation before starting real GPS
    stopSimulation();

    setIsLocating(true);
    setIsLiveTracking(true);
    hasReceivedGpsFixRef.current = false;
    setLocationToast('Acquiring real-time GPS signal...');

    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLng = pos.coords.longitude;
        const rawCoords = { lat: userLat, lng: userLng };
        const accuracy = Math.round(pos.coords.accuracy || 8);
        const heading = pos.coords.heading;

        setIsLocating(false);
        setLiveUserLocation(rawCoords);
        setLiveLocationAccuracyMeters(accuracy);

        // Calculate heading/bearing
        if (heading != null && !isNaN(heading) && heading >= 0) {
          setUserHeading(heading);
        } else if (prevGpsCoordsRef.current) {
          const distMoved = calculateHaversineDistance(prevGpsCoordsRef.current, rawCoords);
          if (distMoved > 2.0) {
            const calculatedBrng = calculateBearing(prevGpsCoordsRef.current, rawCoords);
            setUserHeading(calculatedBrng);
          }
        }
        prevGpsCoordsRef.current = rawCoords;

        // Campus boundary check: warn if user is far from ASTU campus center
        const distFromCampus = calculateHaversineDistance(rawCoords, campusData.meta.center);
        if (distFromCampus > 3500 && !hasReceivedGpsFixRef.current) {
          setLocationToast(`Outside ASTU campus (±${accuracy}m). Preview mode available.`);
        }

        // When NOT navigating, snap start location to closest campus road node
        if (!isNavigating) {
          setStartCoords(rawCoords);
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
          setStartLabel(`My Live Location (±${accuracy}m)`);
        } else if (routeResult && routeResult.steps.length > 0) {
          // ACTIVE REAL-TIME NAVIGATION: Proximity-based turn auto-advancement
          const currentStep = routeResult.steps[activeNodeIndex];
          if (currentStep && activeNodeIndex < routeResult.steps.length - 1) {
            const distToTurn = calculateHaversineDistance(rawCoords, currentStep.toNode);
            if (distToTurn < 12) {
              setActiveNodeIndex((prev) => {
                const nextIdx = prev + 1;
                const nextStep = routeResult.steps[nextIdx];
                if (nextStep) speakInstruction(nextStep.instruction);
                return nextIdx;
              });
              if (typeof navigator !== 'undefined' && navigator.vibrate) {
                navigator.vibrate(200);
              }
            }
          }

          // Off-route detection & seamless auto-rerouting
          if (destBuilding && !isRecalculatingRef.current) {
            let minDistanceToPath = Infinity;
            for (const node of routeResult.path) {
              const d = calculateHaversineDistance(rawCoords, node);
              if (d < minDistanceToPath) minDistanceToPath = d;
            }

            if (minDistanceToPath > 35) {
              isRecalculatingRef.current = true;
              setLocationToast('Off-route detected — recalculating path...');
              fetchRealWalkingRoute(
                rawCoords,
                destBuilding.center,
                '',
                destBuilding.entranceNodeId,
                campusData
              ).then((recalculated) => {
                setRouteResult(recalculated);
                setActiveNodeIndex(0);
                if (recalculated.steps[0]) speakInstruction(`Rerouted. ${recalculated.steps[0].instruction}`);
                setLocationToast('Route updated');
                setTimeout(() => setLocationToast(null), 3000);
              }).finally(() => {
                isRecalculatingRef.current = false;
              });
            }
          }
        }

        if (!hasReceivedGpsFixRef.current) {
          hasReceivedGpsFixRef.current = true;
          setRecenterTrigger((prev) => prev + 1);
          setLocationToast(`Live GPS Locked (±${accuracy}m accuracy)`);
          setTimeout(() => setLocationToast(null), 3500);
        }
      },
      (err) => {
        const permissionDenied = err.code === err.PERMISSION_DENIED;
        if (permissionDenied) stopLiveLocationTracking(true);
        else setIsLocating(false);

        const message = permissionDenied
          ? 'Location permission was denied. Enable it in browser settings to use live tracking.'
          : 'GPS signal is temporarily weak. Waiting for satellite lock...';
        setLocationToast(message);
        setTimeout(() => setLocationToast(null), 5000);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 2500,
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

  const handleOpenDirectionsToPlace = (
    building: Building,
    room?: Room,
    originChoice?: 'ask' | 'gps' | 'main_gate' | 'oda_gate'
  ) => {
    setDestBuilding(building);
    setDestRoom(room);
    setDestLabel(room ? `${building.code} — ${room.name}` : building.name);
    setSelectedPlace(null);
    setIsDirectionsMode(true);

    if (originChoice === 'gps') {
      handleUseCurrentLocation();
    } else if (originChoice === 'oda_gate') {
      const odaNode = campusData.nodes.find((n) => n.id === 'n_oda_gate');
      if (odaNode) {
        setStartNodeId(odaNode.id);
        setStartCoords({ lat: odaNode.lat, lng: odaNode.lng });
        setStartLabel('Oda Gateway');
        setRecenterTrigger((prev) => prev + 1);
      }
    } else if (originChoice === 'main_gate') {
      const gateNode = campusData.nodes.find((n) => n.id === 'n_main_gate');
      if (gateNode) {
        setStartNodeId(gateNode.id);
        setStartCoords({ lat: gateNode.lat, lng: gateNode.lng });
        setStartLabel('ASTU MAIN GATE');
        setRecenterTrigger((prev) => prev + 1);
      }
    } else if (originChoice === 'ask') {
      setActiveInput('start');
      setSearchQuery('');
    } else if (liveUserLocation) {
      setStartCoords(liveUserLocation);
      setStartLabel('My Live Location');
    } else {
      setActiveInput('start');
      setSearchQuery('');
    }
  };

  const handleStartNavigation = () => {
    if (!routeResult || routeResult.steps.length === 0) return;
    stopSimulation();
    setIsNavigating(true);
    setActiveNodeIndex(0);
    setFollowUser(true);
    if (isVoiceGuidance && routeResult.steps[0]) {
      speakInstruction(routeResult.steps[0].instruction);
    }
  };

  const handleStartSimulation = () => {
    if (!routeResult || routeResult.path.length < 2) return;

    // Stop real-time GPS tracking to avoid conflicting positions
    stopLiveLocationTracking(true);
    stopSimulation();

    setIsNavigating(true);
    setIsSimulating(true);
    setIsSimulationPaused(false);
    setActiveNodeIndex(0);
    setFollowUser(true);

    const firstPt = routeResult.path[0];
    const secondPt = routeResult.path[1];
    setLiveUserLocation({ lat: firstPt.lat, lng: firstPt.lng });
    setLiveLocationAccuracyMeters(3);

    const initialHeading = calculateBearing(firstPt, secondPt);
    setUserHeading(initialHeading);

    simStateRef.current = { segmentIdx: 0, t: 0 };
    setRecenterTrigger((prev) => prev + 1);

    if (isVoiceGuidance && routeResult.steps[0]) {
      speakInstruction(`Starting demo walk. ${routeResult.steps[0].instruction}`);
    }

    setLocationToast('Demo Walk Simulator Started');
    setTimeout(() => setLocationToast(null), 3000);
  };

  const handleStopNavigation = () => {
    stopSimulation();
    setIsNavigating(false);
    setActiveNodeIndex(0);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  };

  // ── ANIMATED LIVE WALK SIMULATION TICKER ──
  useEffect(() => {
    if (!isSimulating || isSimulationPaused || !routeResult || routeResult.path.length < 2) {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
      return;
    }

    const TICK_MS = 60;
    // Speed multiplier: 1x (~1.4 m/s), 2x (~3.5 m/s), 4x (~8.0 m/s)
    const speedMps = simulationSpeed === 4 ? 8.0 : simulationSpeed === 2 ? 3.5 : 1.4;
    const distancePerTick = speedMps * (TICK_MS / 1000);

    simTimerRef.current = setInterval(() => {
      const path = routeResult.path;
      let { segmentIdx, t } = simStateRef.current;

      if (segmentIdx >= path.length - 1) {
        stopSimulation();
        setActiveNodeIndex(routeResult.steps.length - 1);
        const lastNode = path[path.length - 1];
        setLiveUserLocation({ lat: lastNode.lat, lng: lastNode.lng });
        setLocationToast(`Arrived at destination: ${destLabel || 'ASTU'}`);
        if (isVoiceGuidance) {
          speakInstruction(`You have arrived at your destination: ${destLabel || 'ASTU'}`);
        }
        return;
      }

      const p1 = path[segmentIdx];
      const p2 = path[segmentIdx + 1];
      const segDistance = Math.max(calculateHaversineDistance(p1, p2), 0.1);

      const deltaT = distancePerTick / segDistance;
      t += deltaT;

      while (t >= 1.0 && segmentIdx < path.length - 1) {
        t -= 1.0;
        segmentIdx += 1;
      }

      simStateRef.current = { segmentIdx, t };

      if (segmentIdx >= path.length - 1) {
        stopSimulation();
        setActiveNodeIndex(routeResult.steps.length - 1);
        const lastNode = path[path.length - 1];
        setLiveUserLocation({ lat: lastNode.lat, lng: lastNode.lng });
        setLocationToast(`Arrived at destination: ${destLabel || 'ASTU'}`);
        if (isVoiceGuidance) {
          speakInstruction(`You have arrived at your destination: ${destLabel || 'ASTU'}`);
        }
        return;
      }

      const curP1 = path[segmentIdx];
      const curP2 = path[segmentIdx + 1] || curP1;

      const currentLat = curP1.lat + (curP2.lat - curP1.lat) * t;
      const currentLng = curP1.lng + (curP2.lng - curP1.lng) * t;
      const currentPos = { lat: currentLat, lng: currentLng };

      setLiveUserLocation(currentPos);

      // Bearing
      const brng = calculateBearing(curP1, curP2);
      setUserHeading(brng);

      // Proximity check to turn steps
      routeResult.steps.forEach((step, idx) => {
        if (idx > activeNodeIndex) {
          const distToTurn = calculateHaversineDistance(currentPos, step.toNode);
          if (distToTurn < 11) {
            setActiveNodeIndex(idx);
            if (isVoiceGuidance) {
              speakInstruction(step.instruction);
            }
          }
        }
      });
    }, TICK_MS);

    return () => {
      if (simTimerRef.current) {
        clearInterval(simTimerRef.current);
        simTimerRef.current = null;
      }
    };
  }, [isSimulating, isSimulationPaused, simulationSpeed, routeResult, activeNodeIndex, isVoiceGuidance, destLabel]);

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

  // ── RESPONSIVE SCROLL / SWIPE MODE: change direction steps with gestures ──
  const SWIPE_THRESHOLD_PX = 45;
  const WHEEL_THRESHOLD_PX = 60;
  const stepTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const wheelAccumRef = useRef<number>(0);
  const wheelLockedRef = useRef<boolean>(false);
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wheelLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up gesture timers on unmount
  useEffect(() => {
    return () => {
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
      if (wheelLockTimerRef.current) clearTimeout(wheelLockTimerRef.current);
    };
  }, []);

  // Touch swipe: flick the guidance card left / up → next step, right / down → previous step
  const handleGuidanceTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    stepTouchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleGuidanceTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const start = stepTouchStartRef.current;
    stepTouchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    // Below threshold → treat as a normal tap (buttons on the card still work)
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD_PX) return;
    const goingNext = Math.abs(dx) >= Math.abs(dy) ? dx < 0 : dy < 0;
    if (goingNext) handleNextStep();
    else handlePrevStep();
  };

  // Mouse wheel / trackpad scroll: scroll down → next step, scroll up → previous step
  const handleGuidanceWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (wheelLockedRef.current) return;
    // Normalize line-mode wheel deltas (deltaMode 1) to pixels
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    wheelAccumRef.current += delta;

    if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
    wheelResetTimerRef.current = setTimeout(() => {
      wheelAccumRef.current = 0;
    }, 250);

    if (Math.abs(wheelAccumRef.current) >= WHEEL_THRESHOLD_PX) {
      if (wheelAccumRef.current > 0) handleNextStep();
      else handlePrevStep();
      wheelAccumRef.current = 0;
      wheelLockedRef.current = true;
      wheelLockTimerRef.current = setTimeout(() => {
        wheelLockedRef.current = false;
      }, 450);
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

  // Dynamic bottom positioning for floating action rail (Assistant, Layer, GPS)
  // Automatically shifts above mobile bottom sheets (location detail peek, route summary)
  // or hides when sheets are expanded on small screens to prevent overlap.
  const floatingRailPosition = useMemo(() => {
    if (isNavigating) {
      return 'bottom-24 md:bottom-6';
    }
    if (selectedPlace && !isDirectionsMode) {
      if (isPlaceSheetExpanded) {
        return 'hidden md:flex md:bottom-6';
      }
      return 'bottom-[112px] md:bottom-6';
    }
    if (isDirectionsMode && routeResult) {
      if (isStepsExpanded) {
        return 'hidden md:flex md:bottom-6';
      }
      return 'bottom-[160px] md:bottom-6';
    }
    return 'bottom-6 md:bottom-6';
  }, [isNavigating, selectedPlace, isDirectionsMode, isPlaceSheetExpanded, routeResult, isStepsExpanded]);

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

  // Venues belonging to the currently selected quick category chip, sorted by distance
  const categoryPlaces = useMemo(() => {
    if (!selectedCategory) return [];
    const list = campusData.buildings.filter((b) => b.category === selectedCategory);
    if (liveUserLocation) {
      return list
        .map((b) => ({
          building: b,
          distanceMeters: Math.round(calculateHaversineDistance(liveUserLocation, b.center)),
        }))
        .sort((a, b) => a.distanceMeters - b.distanceMeters);
    }
    return list.map((b) => ({ building: b, distanceMeters: null }));
  }, [selectedCategory, campusData, liveUserLocation]);

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
        liveLocationAccuracyMeters={liveLocationAccuracyMeters}
        userHeading={userHeading}
        isNavigating={isNavigating}
        followUser={followUser}
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

      {/* TOP FLOATING SEARCH BAR & DROPDOWN RESULTS (HIGHEST PRIORITY Z-INDEX z-[1000]) */}
      {!isNavigating && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 md:left-4 md:translate-x-0 z-[1000] w-[calc(100vw-1.5rem)] max-w-[420px] md:w-[420px] pointer-events-auto">
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
                  onClick={() => setIsAIAssistantOpen(true)}
                  className="p-2 md:p-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-all shadow flex items-center justify-center flex-shrink-0 cursor-pointer active:scale-95 group"
                  title="Open Assistant"
                  aria-label="Open Assistant"
                >
                  <Sparkles className="w-4 h-4 text-blue-400 group-hover:text-blue-300 transition-colors" />
                </button>
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

                <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-[11px] font-medium text-gray-600">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setIsAccessibleMode(false)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        !isAccessibleMode
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                    >
                      <Footprints className="w-3.5 h-3.5" /> Walk
                    </button>

                    <button
                      onClick={() => setIsAccessibleMode(true)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                        isAccessibleMode
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      }`}
                      title="Accessible route avoiding stairs and steep paths"
                    >
                      <Accessibility className="w-3.5 h-3.5" /> Accessible
                    </button>
                  </div>

                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                    {isAccessibleMode ? 'Ramps Only' : 'Fastest'}
                  </span>
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
                    <span className="truncate">{isLocating ? 'Starting live tracking...' : isLiveTracking ? 'Live GPS tracking is active' : 'Use My Live GPS Location'}</span>
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

          {/* QUICK CATEGORY CHIPS BAR (GOOGLE MAPS STYLE) */}
          {!isDirectionsMode && !activeInput && (
            <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar select-none">
              {CAMPUS_CATEGORIES.map((cat) => {
                const IconComp = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(isSelected ? null : cat.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap shadow-md transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-blue-500/30 scale-105'
                        : `${cat.color} bg-white/95 backdrop-blur-md`
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* FIND NEAREST CAMPUS VENUES DRAWER */}
          {!isDirectionsMode && selectedCategory && (
            <div className="mt-2 bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-gray-200 overflow-hidden max-h-[380px] flex flex-col pointer-events-auto animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3.5 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase tracking-wider text-gray-700">
                    {CAMPUS_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {categoryPlaces.length} locations
                  </span>
                </div>
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="text-gray-400 hover:text-gray-700 p-1 rounded-full hover:bg-gray-200 transition-colors cursor-pointer"
                  title="Close category drawer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-y-auto divide-y divide-gray-100 custom-scrollbar p-1">
                {categoryPlaces.length === 0 ? (
                  <div className="p-4 text-center text-xs text-gray-500">
                    No locations found in this category.
                  </div>
                ) : (
                  categoryPlaces.map(({ building, distanceMeters }) => (
                    <div
                      key={building.id}
                      className="p-2.5 hover:bg-blue-50/70 rounded-xl transition-colors flex items-center justify-between gap-2.5 group"
                    >
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => {
                          setSelectedPlace(building);
                          setRecenterTrigger((prev) => prev + 1);
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-xs text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                            {building.name}
                          </h4>
                          <span className="text-[10px] font-extrabold px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded">
                            {building.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-500 truncate mt-0.5">
                          {building.details?.department || building.details?.description || 'ASTU Campus'}
                        </p>
                        {distanceMeters !== null && (
                          <div className="flex items-center gap-1 text-[11px] font-extrabold text-emerald-600 mt-0.5">
                            <Footprints className="w-3 h-3" />
                            <span>{formatDistance(distanceMeters)} away</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setSelectedPlace(building);
                            setRecenterTrigger((prev) => prev + 1);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 hover:text-gray-900 text-xs font-semibold transition-colors cursor-pointer"
                          title="View on Map"
                        >
                          <MapPin className="w-4 h-4 text-gray-600" />
                        </button>

                        <button
                          onClick={() => {
                            setSelectedCategory(null);
                            handleOpenDirectionsToPlace(building, undefined, liveUserLocation ? 'gps' : 'main_gate');
                          }}
                          className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition-all active:scale-95 cursor-pointer"
                          title="Get walking directions"
                        >
                          <Navigation className="w-3 h-3 fill-white" />
                          <span>Go</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* RICH PLACE DETAILS SHEET (Z-INDEX z-[1000]) */}
      {selectedPlace && !isNavigating && !isDirectionsMode && (
        <div className="absolute bottom-0 left-0 right-0 md:top-[92px] md:left-4 md:right-auto md:bottom-auto z-[1000] w-full md:w-[420px] pointer-events-auto transition-all duration-300">
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
                  onClick={() => handleSharePlace(selectedPlace)}
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                  title="Share Location"
                >
                  <Share2 className="w-4 h-4" />
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

                  <button
                    onClick={() => handleSharePlace(selectedPlace)}
                    className="py-2.5 px-3 bg-gray-100 hover:bg-blue-50 text-gray-700 hover:text-blue-600 font-bold text-xs rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                    title="Share Location Link"
                  >
                    <Share2 className="w-4 h-4 text-blue-600" />
                    <span>Share</span>
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
                      <span className="text-gray-400 block text-[10px] font-bold uppercase">Block Code</span>
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
        <div className="absolute bottom-0 left-0 right-0 md:left-4 md:right-auto md:bottom-4 z-[1000] w-full md:w-[420px] pointer-events-auto transition-all duration-300">
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
                    {formatTime(routeResult.estimatedTimeMinutes)}
                  </span>
                  <span className="text-sm font-bold text-gray-500">
                    ({formatDistance(routeResult.totalDistanceMeters)})
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-medium mt-0.5">
                  {isAccessibleMode ? '♿ Accessible ramp path (No stairs)' : 'Fastest foot path • ASTU Campus'}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleStartSimulation}
                  className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs md:text-sm rounded-lg shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Run an animated live walking simulation of this route (Demo presentation mode)"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>Demo Walk</span>
                </button>

                <button
                  onClick={handleStartNavigation}
                  className="px-5 py-2.5 bg-[#1a73e8] hover:bg-blue-700 text-white font-black text-xs md:text-sm rounded-lg shadow flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                  title="Start real-time turn-by-turn navigation"
                >
                  <Navigation className="w-4 h-4 fill-white" />
                  <span>Start</span>
                </button>
              </div>
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
                          {formatDistance(step.distanceMeters)}
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

      {/* ACTIVE NAVIGATION GUIDANCE BAR (Z-INDEX z-[1000]) */}
      {isNavigating && routeResult && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-lg pointer-events-auto">
          <div
            onTouchStart={handleGuidanceTouchStart}
            onTouchEnd={handleGuidanceTouchEnd}
            onWheel={handleGuidanceWheel}
            className={`rounded-2xl shadow-2xl p-4 flex flex-col gap-2.5 text-white border transition-colors touch-none select-none ${
              isArrived ? 'bg-emerald-600 border-emerald-500' : 'bg-[#1a73e8] border-blue-500'
            }`}
          >
            {/* Simulation & Real-time Live Status Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-white/20 text-xs">
              {isSimulating ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[10px] md:text-[11px] font-black uppercase tracking-wider border border-emerald-400/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Demo Walk ({simulationSpeed}x)
                  </span>

                  {/* Play / Pause Toggle */}
                  <button
                    onClick={() => setIsSimulationPaused(!isSimulationPaused)}
                    className="p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                    title={isSimulationPaused ? 'Resume Demo Walk' : 'Pause Demo Walk'}
                  >
                    {isSimulationPaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5 fill-white" />}
                  </button>

                  {/* Speed Toggle (1x -> 2x -> 4x) */}
                  <button
                    onClick={() => setSimulationSpeed(simulationSpeed === 1 ? 2 : simulationSpeed === 2 ? 4 : 1)}
                    className="px-1.5 py-0.5 hover:bg-white/20 rounded text-[11px] font-black transition-colors cursor-pointer bg-white/10"
                    title="Change Walking Speed"
                  >
                    {simulationSpeed}x
                  </button>

                  {/* Restart Demo Walk */}
                  <button
                    onClick={handleStartSimulation}
                    className="p-1 hover:bg-white/20 rounded-md transition-colors cursor-pointer"
                    title="Restart Demo Walk from start"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : isLiveTracking ? (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 text-[11px] font-black uppercase tracking-wider border border-emerald-400/40">
                    <Radio className="w-3 h-3 text-emerald-300 animate-pulse" />
                    Live GPS (±{liveLocationAccuracyMeters || 8}m)
                  </span>
                </div>
              ) : (
                <span className="text-[11px] text-white/80 font-bold uppercase tracking-wider">
                  Step-by-Step Navigation
                </span>
              )}

              <div className="flex items-center gap-2">
                {/* Voice Guidance Toggle */}
                <button
                  onClick={() => {
                    const nextVal = !isVoiceGuidance;
                    setIsVoiceGuidance(nextVal);
                    setLocationToast(nextVal ? 'Voice guidance ON' : 'Voice guidance MUTED');
                    setTimeout(() => setLocationToast(null), 2000);
                  }}
                  className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                    isVoiceGuidance ? 'bg-white/25 text-white' : 'text-white/50 hover:bg-white/10'
                  }`}
                  title={isVoiceGuidance ? 'Mute Voice Directions' : 'Enable Voice Directions'}
                >
                  {isVoiceGuidance ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                </button>

                {/* Close Button */}
                <button
                  onClick={handleStopNavigation}
                  className="w-7 h-7 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs flex items-center justify-center transition-colors shadow cursor-pointer"
                  title="Stop / Exit Navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Swipe / Scroll affordance hint */}
            {!isArrived && (
              <div className="flex items-center justify-center gap-2 -mt-0.5 mb-0.5 text-[9px] font-bold uppercase tracking-widest text-white/70">
                <span className="w-6 h-1 rounded-full bg-white/40" />
                <span>Swipe or scroll card to change step</span>
                <span className="w-6 h-1 rounded-full bg-white/40" />
              </div>
            )}

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

      {/* Floating Target GPS Button, Map Type Toggle Switch & AI Assistant FAB with z-[1000] */}
      <div
        style={{ zIndex: 1000 }}
        className={`absolute right-4 md:right-6 flex flex-col gap-2 pointer-events-auto transition-all duration-300 ease-in-out ${floatingRailPosition}`}
      >
        <button
          onClick={() => setIsAIAssistantOpen(true)}
          className="w-11 h-11 bg-slate-900 hover:bg-slate-800 text-white rounded-xl shadow-xl border border-slate-700/80 flex items-center justify-center transition-all cursor-pointer active:scale-95 group"
          title="Open AI Assistant"
        >
          <Sparkles className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
        </button>

        <button
          onClick={() => setMapType(mapType === 'roadmap' ? 'satellite' : 'roadmap')}
          className="w-11 h-11 bg-white hover:bg-gray-100 text-gray-700 rounded-xl shadow-xl border border-gray-200 flex items-center justify-center transition-all cursor-pointer"
          title={`Switch to ${mapType === 'roadmap' ? 'Satellite' : 'Default Map'} View`}
        >
          <Layers className="w-5 h-5 text-blue-600" />
        </button>

        <button
          onClick={isLiveTracking ? () => stopLiveLocationTracking() : handleUseCurrentLocation}
          disabled={isLocating}
          className={`w-11 h-11 rounded-xl shadow-xl border flex items-center justify-center transition-all cursor-pointer ${
            isLiveTracking
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-700 ring-4 ring-emerald-400/40'
              : 'bg-white hover:bg-gray-100 text-blue-600 border-gray-200'
          }`}
          title={isLiveTracking ? `Live GPS Active (±${liveLocationAccuracyMeters || 10}m) — Click to pause` : 'Start Live Real-Time GPS Tracking'}
        >
          {isLocating ? (
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
          ) : isLiveTracking ? (
            <LocateFixed className="w-5 h-5 animate-pulse" />
          ) : (
            <LocateFixed className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* ASTU AI CAMPUS ASSISTANT MODAL / DRAWER */}
      <AIAssistantModal
        isOpen={isAIAssistantOpen}
        onClose={() => setIsAIAssistantOpen(false)}
        campusData={campusData}
        onSelectPlace={(building) => {
          setSelectedPlace(building);
          setRecenterTrigger((prev) => prev + 1);
        }}
        onStartDirections={(building, room, originChoice) => {
          handleOpenDirectionsToPlace(building, room, originChoice);
        }}
      />
    </div>
  );
}
