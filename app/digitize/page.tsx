'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Compass,
  Crosshair,
  Route,
  Waypoints,
  SlidersHorizontal,
  Shapes,
  Maximize2,
  Minimize2,
  Undo2,
  Save,
  Download,
  ArrowLeft,
  Building2,
  MapPin,
  LocateFixed,
  Scissors,
  Plus,
  Check,
  Loader2,
  Info,
  Accessibility,
  Layers,
  Zap,
  Network,
  Unlink,
} from 'lucide-react';
import { CampusData, Building, PathNode, PathEdge, LatLng } from '../../lib/types/map';

const defaultFallbackData: CampusData = {
  meta: { name: 'ASTU Campus Map', center: { lat: 8.5639, lng: 39.2887 }, zoom: 17 },
  buildings: [],
  nodes: [],
  edges: [],
};

const DigitizeMapClient = dynamic(() => import('./DigitizeMapClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 text-sm">
      <span>Loading Digitizer Satellite Map...</span>
    </div>
  ),
});

export default function DigitizePage() {
  const [campus, setCampus] = useState<CampusData>(defaultFallbackData);
  const [isLoadingData, setIsLoadingData] = useState(true);

  useEffect(() => {
    fetch('/api/campus-data')
      .then((res) => res.json())
      .then((data) => {
        if (data && data.nodes) {
          setCampus(data);
        }
      })
      .catch((err) => console.error('Failed to load campus data:', err))
      .finally(() => setIsLoadingData(false));
  }, []);

  const [mode, setMode] = useState<'view' | 'building' | 'node' | 'edge' | 'edit'>('view');

  const handleDeleteNode = (nodeId: string) => {
    setCampus((prev) => ({
      ...prev,
      nodes: prev.nodes.filter((n) => n.id !== nodeId),
      edges: prev.edges.filter((e) => e.source !== nodeId && e.target !== nodeId),
    }));
    if (lastRoadNodeId === nodeId) {
      setLastRoadNodeId(null);
    }
  };

  const handleDeleteEdge = (edgeId: string) => {
    setCampus((prev) => ({
      ...prev,
      edges: prev.edges.filter((e) => e.id !== edgeId),
    }));
  };

  // Building polygon points in Lat/Lng
  const [currPolygon, setCurrPolygon] = useState<LatLng[]>([]);
  const [bCode, setBCode] = useState('');
  const [bName, setBName] = useState('');

  // Manual Lat/Lng coordinate input form state
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualLabel, setManualLabel] = useState('');

  // Edge creation state
  const [selectedSourceNode, setSelectedSourceNode] = useState<string | null>(null);

  // Continuous Road Tracing state
  const [lastRoadNodeId, setLastRoadNodeId] = useState<string | null>(null);

  const [clickedLatLng, setClickedLatLng] = useState<LatLng | null>(null);

  // New location / building registration form state
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState<'academic' | 'administrative' | 'dining' | 'dormitory' | 'sports' | 'other'>('academic');
  const [connectToRoadId, setConnectToRoadId] = useState<string>('');

  // Edge customization state
  const [roadType, setRoadType] = useState<'asphalt_road' | 'paved_walkway' | 'dirt_path' | 'stairs'>('paved_walkway');
  const [isOneWay, setIsOneWay] = useState(false);
  const [handicapAccessible, setHandicapAccessible] = useState(true);

  const handleAddMapClick = (latlng: LatLng) => {
    setClickedLatLng(latlng);
    setManualLat(latlng.lat.toFixed(6));
    setManualLng(latlng.lng.toFixed(6));

    if (mode === 'building') {
      setCurrPolygon((prev) => [...prev, latlng]);
    } else if (mode === 'node') {
      // Check if click is very close (~8 meters) to an existing road/entrance node to branch/join existing main roads!
      const snapThresholdDegrees = 0.0001; // ~10 meters threshold
      let targetNodeId: string | null = null;

      for (const n of campus.nodes) {
        const dist = Math.hypot(n.lat - latlng.lat, n.lng - latlng.lng);
        if (dist < snapThresholdDegrees) {
          targetNodeId = n.id;
          break;
        }
      }

      if (targetNodeId) {
        // Snap to existing node: create connection edge to existing node instead of creating duplicate node!
        if (lastRoadNodeId && lastRoadNodeId !== targetNodeId) {
          const edgeExists = campus.edges.some(
            (e) =>
              (e.source === lastRoadNodeId && e.target === targetNodeId) ||
              (e.source === targetNodeId && e.target === lastRoadNodeId)
          );
          if (!edgeExists) {
            const newEdge: PathEdge = {
              id: `e_${lastRoadNodeId}_${targetNodeId}`,
              source: lastRoadNodeId,
              target: targetNodeId,
              type: roadType,
              isOneWay: isOneWay,
              handicapAccessible: handicapAccessible,
            };
            setCampus((prev) => ({
              ...prev,
              edges: [...prev.edges, newEdge],
            }));
          }
        }
        setLastRoadNodeId(targetNodeId);
      } else {
        // Create new road node
        const newNodeId = `r_${Date.now().toString().slice(-6)}`;
        const newNode: PathNode = {
          id: newNodeId,
          lat: Number(latlng.lat.toFixed(6)),
          lng: Number(latlng.lng.toFixed(6)),
          label: `Road Point`,
        };

        setCampus((prev) => {
          const nextNodes = [...prev.nodes, newNode];
          let nextEdges = [...prev.edges];

          if (lastRoadNodeId) {
            nextEdges.push({
              id: `e_${lastRoadNodeId}_${newNodeId}`,
              source: lastRoadNodeId,
              target: newNodeId,
              type: roadType,
              isOneWay: isOneWay,
              handicapAccessible: handicapAccessible,
            });
          }
          return {
            ...prev,
            nodes: nextNodes,
            edges: nextEdges,
          };
        });

        setLastRoadNodeId(newNodeId);
      }
    }
  };

  const handleRegisterLocation = () => {
    if (!clickedLatLng || !newCode.trim() || !newName.trim()) {
      alert('Please click a point on the map and fill in Location Code and Name.');
      return;
    }

    const lat = Number(clickedLatLng.lat.toFixed(6));
    const lng = Number(clickedLatLng.lng.toFixed(6));
    const codeUpper = newCode.trim().toUpperCase();

    // Create entrance node at the exact clicked spot
    const entranceNodeId = `n_${codeUpper.toLowerCase()}`;
    const entranceNode: PathNode = {
      id: entranceNodeId,
      lat,
      lng,
      label: `${newName.trim()} (${codeUpper})`,
    };

    // Quick bounding polygon box ~10 meters around clicked center
    const delta = 0.00012;
    const polygon: LatLng[] = [
      { lat: lat + delta, lng: lng - delta },
      { lat: lat + delta, lng: lng + delta },
      { lat: lat - delta, lng: lng + delta },
      { lat: lat - delta, lng: lng - delta },
    ];

    const newBuilding: Building = {
      id: `b_${codeUpper.toLowerCase()}`,
      code: codeUpper,
      name: newName.trim(),
      aliases: [newName.trim(), codeUpper],
      category: newCategory,
      polygon,
      center: { lat, lng },
      rooms: [
        {
          id: `${codeUpper.toLowerCase()}_main`,
          name: `${newName.trim()} Main Hall`,
          floor: 1,
          type: 'Hall',
          workDescription: `Main facility area for ${newName.trim()}.`,
        },
      ],
      entranceNodeId,
    };

    setCampus((prev) => {
      const nextNodes = [...prev.nodes, entranceNode];
      const nextEdges = [...prev.edges];

      // Connect entrance node directly to chosen road node (if selected)
      if (connectToRoadId) {
        nextEdges.push({
          id: `e_${entranceNodeId}_${connectToRoadId}`,
          source: entranceNodeId,
          target: connectToRoadId,
        });
      }

      return {
        ...prev,
        buildings: [...prev.buildings, newBuilding],
        nodes: nextNodes,
        edges: nextEdges,
      };
    });

    // Reset form
    setNewCode('');
    setNewName('');
    setConnectToRoadId('');
    alert(`Registered ${newName.trim()} successfully!`);
  };

  const handleAddManualNode = () => {
    const lat = parseFloat(manualLat);
    const lng = parseFloat(manualLng);
    if (isNaN(lat) || isNaN(lng)) {
      alert('Please enter valid numerical Latitude and Longitude.');
      return;
    }
    const newNode: PathNode = {
      id: `n_${Date.now().toString().slice(-5)}`,
      lat: Number(lat.toFixed(6)),
      lng: Number(lng.toFixed(6)),
      label: manualLabel.trim() || `Node (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
    };
    setCampus((prev) => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setManualLat('');
    setManualLng('');
    setManualLabel('');
  };

  const handleFinishBuilding = () => {
    if (currPolygon.length < 3 || !bCode.trim() || !bName.trim()) {
      alert('Please click at least 3 points on the satellite map and fill in Building Code & Name.');
      return;
    }

    const avgLat = Number(
      (currPolygon.reduce((acc, p) => acc + p.lat, 0) / currPolygon.length).toFixed(6)
    );
    const avgLng = Number(
      (currPolygon.reduce((acc, p) => acc + p.lng, 0) / currPolygon.length).toFixed(6)
    );

    const entranceNodeId = `n_ent_${bCode.toLowerCase()}`;
    const entranceNode: PathNode = {
      id: entranceNodeId,
      lat: avgLat,
      lng: avgLng,
      label: `${bCode} Entrance`,
    };

    const newBuilding: Building = {
      id: `b_${Date.now()}`,
      code: bCode.trim().toUpperCase(),
      name: bName.trim(),
      aliases: [],
      category: 'academic',
      polygon: currPolygon,
      center: { lat: avgLat, lng: avgLng },
      rooms: [],
      entranceNodeId,
    };

    setCampus((prev) => ({
      ...prev,
      buildings: [...prev.buildings, newBuilding],
      nodes: [...prev.nodes, entranceNode],
    }));

    setCurrPolygon([]);
    setBCode('');
    setBName('');
  };

  const handleNodeClick = (nodeId: string) => {
    if (mode === 'edge') {
      if (!selectedSourceNode) {
        setSelectedSourceNode(nodeId);
      } else if (selectedSourceNode !== nodeId) {
        const newEdge: PathEdge = {
          id: `e_${selectedSourceNode}_${nodeId}`,
          source: selectedSourceNode,
          target: nodeId,
          type: roadType,
          isOneWay: isOneWay,
          handicapAccessible: handicapAccessible,
        };
        setCampus((prev) => ({
          ...prev,
          edges: [...prev.edges, newEdge],
        }));
        setSelectedSourceNode(null);
      }
    }
  };

  const handleUndoLastNode = () => {
    if (campus.nodes.length === 0) return;
    const lastNode = campus.nodes[campus.nodes.length - 1];

    setCampus((prev) => {
      const nextNodes = prev.nodes.slice(0, -1);
      const nextEdges = prev.edges.filter((e) => e.source !== lastNode.id && e.target !== lastNode.id);
      return {
        ...prev,
        nodes: nextNodes,
        edges: nextEdges,
      };
    });

    if (lastRoadNodeId === lastNode.id) {
      const remainingRoadNodes = campus.nodes.filter((n) => n.id !== lastNode.id && n.id.startsWith('r_'));
      setLastRoadNodeId(remainingRoadNodes.length > 0 ? remainingRoadNodes[remainingRoadNodes.length - 1].id : null);
    }
  };

  const handleUndoLastEdge = () => {
    if (campus.edges.length === 0) return;
    setCampus((prev) => ({
      ...prev,
      edges: prev.edges.slice(0, -1),
    }));
  };

  const handleAutoConnectBuildingNodes = () => {
    let addedCount = 0;
    const roadNodes = campus.nodes.filter((n) => n.id.startsWith('r_'));

    if (roadNodes.length === 0) {
      alert('Please draw at least a few road points first before auto-connecting building entrances!');
      return;
    }

    setCampus((prev) => {
      const nextEdges = [...prev.edges];
      const buildingNodes = prev.nodes.filter((n) => n.id.startsWith('n_'));

      buildingNodes.forEach((bNode) => {
        // Check if building node is already connected to any road edge
        const isConnected = nextEdges.some((e) => e.source === bNode.id || e.target === bNode.id);
        if (!isConnected) {
          // Find closest road node
          let closestRoadNode = roadNodes[0];
          let minDist = Infinity;

          roadNodes.forEach((rNode) => {
            const d = Math.hypot(bNode.lat - rNode.lat, bNode.lng - rNode.lng);
            if (d < minDist) {
              minDist = d;
              closestRoadNode = rNode;
            }
          });

          // Connect building entrance node to nearest road node
          nextEdges.push({
            id: `e_auto_${bNode.id}_${closestRoadNode.id}`,
            source: bNode.id,
            target: closestRoadNode.id,
            type: 'paved_walkway',
            isOneWay: false,
            handicapAccessible: true,
          });
          addedCount++;
        }
      });

      return {
        ...prev,
        edges: nextEdges,
      };
    });

    alert(`Auto-connected ${addedCount} building entrance nodes to their nearest road points.`);
  };

  const [autoSave, setAutoSave] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const isInitialMount = React.useRef(true);
  const latestCampusRef = React.useRef(campus);
  latestCampusRef.current = campus;

  const saveToDisk = async (dataToSave = latestCampusRef.current) => {
    setIsSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch('/api/save-campus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dataToSave),
      });
      const result = await res.json();
      if (result.success) {
        setHasUnsavedChanges(false);
        setSaveStatus('Saved to Codebase!');
        setTimeout(() => setSaveStatus(null), 3000);
      } else {
        console.error('Failed to save to project:', result.error);
      }
    } catch (err) {
      console.error('Error saving to project file:', err);
    } finally {
      setIsSaving(false);
    }
  };

  // Track unsaved changes on campus update
  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    setHasUnsavedChanges(true);
  }, [campus]);

  // Periodic auto-save every 1 minute (60,000 ms) when enabled
  React.useEffect(() => {
    if (!autoSave) return;

    const interval = setInterval(() => {
      saveToDisk(latestCampusRef.current);
    }, 60000);

    return () => clearInterval(interval);
  }, [autoSave]);

  const exportJSON = () => {
    const jsonStr = JSON.stringify(campus, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'campus.json';
    a.click();
  };

  const [isFullScreen, setIsFullScreen] = useState(false);

  return (
    <div className="min-h-screen bg-[#060a12] text-slate-100 p-3 sm:p-5 flex flex-col gap-4 font-sans relative selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Top Professional GIS Command Header */}
      <header className="flex flex-wrap items-center justify-between gap-3.5 bg-slate-900/80 backdrop-blur-md border border-slate-800/90 px-4 sm:px-5 py-3 rounded-2xl shadow-xl relative overflow-hidden">
        {/* Subtle Accent Edge Light */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent pointer-events-none" />

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-cyan-400 shadow-inner shrink-0">
            <Compass className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-semibold tracking-tight text-white">
                ASTU GIS Cartography Studio
              </h1>
              <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-md bg-slate-800/90 text-slate-300 border border-slate-700/80">
                v3.2
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-medium text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Grid
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Precision Geospatial Node & Walkway Digitizer
            </p>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Navigator Back Link */}
          <a
            href="/"
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
            <span>Navigator</span>
          </a>

          <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

          {/* History Controls */}
          <div className="flex items-center bg-slate-800/60 p-0.5 rounded-xl border border-slate-700/80">
            <button
              onClick={handleUndoLastNode}
              title="Undo last added road/entrance node point"
              className="px-2.5 py-1.5 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Undo Node</span>
            </button>
            <div className="h-3.5 w-[1px] bg-slate-700/60" />
            <button
              onClick={handleUndoLastEdge}
              title="Undo last added road edge connection"
              className="px-2.5 py-1.5 hover:bg-slate-700/80 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5 text-slate-400" />
              <span>Undo Link</span>
            </button>
          </div>

          {/* Automation Tools */}
          <button
            onClick={handleAutoConnectBuildingNodes}
            title="Automatically snap and connect every building entrance node to its nearest drawn road point"
            className="px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-sm hover:border-indigo-500/50"
          >
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Auto-Connect</span>
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/80 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            {isFullScreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Exit Fullscreen</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-slate-400" />
                <span>Fullscreen</span>
              </>
            )}
          </button>

          <div className="h-4 w-[1px] bg-slate-800 hidden sm:block" />

          {/* Auto-Save Toggle */}
          <label className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-800/40 border border-slate-800 hover:border-slate-700 rounded-xl text-xs text-slate-300 font-medium cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="accent-cyan-500 rounded cursor-pointer w-3.5 h-3.5"
            />
            <span className="text-[11px] text-slate-300">Auto-Save (1m)</span>
          </label>

          {/* Save Button */}
          <button
            onClick={() => saveToDisk()}
            disabled={isSaving}
            className={`px-3.5 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              hasUnsavedChanges
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold shadow-md shadow-amber-500/20'
                : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-sm'
            }`}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : saveStatus ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Saved!</span>
              </>
            ) : hasUnsavedChanges ? (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Changes</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" />
                <span>Save Now</span>
              </>
            )}
          </button>

          {/* Export JSON */}
          <button
            onClick={exportJSON}
            className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/80 rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export JSON</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: Digitizer Studio Controls Panel */}
        <div className="lg:col-span-4 bg-slate-900/70 border border-slate-800/90 rounded-2xl p-4 flex flex-col gap-4 shadow-xl backdrop-blur-sm">
          {/* Active Digitizer Tool Mode Toolbar */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-mono font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3 h-3 text-cyan-400" />
                Active Digitizer Tool
              </label>
              <span className="text-[10px] font-mono text-slate-500 uppercase">
                Mode: {mode}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-1.5">
              {[
                {
                  id: 'view',
                  label: 'Point Capture & Register',
                  desc: 'Click satellite map to capture Lat/Lng coordinates',
                  icon: Crosshair,
                  activeColor: 'bg-cyan-500/10 border-cyan-500/40 text-cyan-300 ring-1 ring-cyan-500/20',
                  iconColor: 'text-cyan-400',
                },
                {
                  id: 'node',
                  label: 'Draw Campus Roads',
                  desc: 'Click consecutively to auto-trace road paths',
                  icon: Route,
                  activeColor: 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20',
                  iconColor: 'text-emerald-400',
                },
                {
                  id: 'edge',
                  label: 'Link Custom Nodes',
                  desc: 'Click two nodes to establish a topological connection',
                  icon: Waypoints,
                  activeColor: 'bg-indigo-500/10 border-indigo-500/40 text-indigo-300 ring-1 ring-indigo-500/20',
                  iconColor: 'text-indigo-400',
                },
                {
                  id: 'edit',
                  label: 'Inspect & Prune',
                  desc: 'Click on nodes or edges to view details or remove',
                  icon: SlidersHorizontal,
                  activeColor: 'bg-amber-500/10 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/20',
                  iconColor: 'text-amber-400',
                },
                {
                  id: 'building',
                  label: 'Trace Building Polygon',
                  desc: 'Click 3+ boundary corners to outline a footprint',
                  icon: Shapes,
                  activeColor: 'bg-sky-500/10 border-sky-500/40 text-sky-300 ring-1 ring-sky-500/20',
                  iconColor: 'text-sky-400',
                },
              ].map((m) => {
                const isActive = mode === m.id;
                const IconComponent = m.icon;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id as any);
                      setSelectedSourceNode(null);
                      setLastRoadNodeId(null);
                    }}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer flex items-start gap-3 ${
                      isActive
                        ? m.activeColor
                        : 'bg-slate-900/40 border-slate-800/80 text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                    }`}
                  >
                    <div
                      className={`p-1.5 rounded-lg border mt-0.5 shrink-0 ${
                        isActive
                          ? 'bg-slate-950 border-slate-700/80'
                          : 'bg-slate-800/60 border-slate-700/40'
                      }`}
                    >
                      <IconComponent
                        className={`w-4 h-4 ${isActive ? m.iconColor : 'text-slate-400'}`}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold leading-tight">{m.label}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5 leading-snug truncate">
                        {m.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Contextual Mode Guidance & Segment Inspector */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                <span>Workflow Guidance</span>
              </span>
              {mode === 'node' && lastRoadNodeId && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300">
                  Tracing Active
                </span>
              )}
            </div>

            <div className="text-xs text-slate-400 leading-relaxed">
              {mode === 'node' && (
                <div>
                  <p>
                    Click sequentially on the satellite map along any walkway or road. Each click places a node and automatically constructs a connected topological link.
                  </p>
                  {lastRoadNodeId && (
                    <button
                      onClick={() => setLastRoadNodeId(null)}
                      className="mt-2 text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 px-2.5 py-1 rounded-lg font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Scissors className="w-3 h-3 text-amber-400" />
                      <span>Start New Road Segment</span>
                    </button>
                  )}
                </div>
              )}
              {mode === 'view' &&
                'Click any position on the satellite imagery to sample precise coordinates for location registration or node creation.'}
              {mode === 'edge' &&
                (selectedSourceNode
                  ? `Source selected: ${selectedSourceNode}. Now click target node to create link.`
                  : 'Click the source node (Node A), then click target node (Node B) to create a custom path link.')}
              {mode === 'edit' &&
                'Click any road waypoint or edge polyline on the map to inspect properties or remove it from the campus graph.'}
              {mode === 'building' &&
                `Click at least 3 corner boundary points on the satellite map to outline a building footprint polygon (${currPolygon.length} corners placed).`}
            </div>
          </div>

          {/* Advanced Edge Customization Controls */}
          {(mode === 'node' || mode === 'edge') && (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-200">
                <span className="flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
                  Road & Path Specifications
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-medium">Surface Classification:</label>
                <select
                  value={roadType}
                  onChange={(e) => setRoadType(e.target.value as any)}
                  className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
                >
                  <option value="paved_walkway">Paved Pedestrian Walkway</option>
                  <option value="asphalt_road">Asphalt Vehicle Road</option>
                  <option value="dirt_path">Natural Footpath / Trail</option>
                  <option value="stairs">Outdoor Stairs / Elevation Steps</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/60">
                <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer text-[11px] text-slate-300 hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={isOneWay}
                    onChange={(e) => setIsOneWay(e.target.checked)}
                    className="accent-cyan-500 rounded"
                  />
                  <span>One-Way Flow</span>
                </label>
                <label className="flex items-center gap-2 p-1.5 rounded-lg bg-slate-900/60 border border-slate-800 cursor-pointer text-[11px] text-slate-300 hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={handicapAccessible}
                    onChange={(e) => setHandicapAccessible(e.target.checked)}
                    className="accent-emerald-500 rounded"
                  />
                  <span className="flex items-center gap-1">
                    <Accessibility className="w-3 h-3 text-emerald-400" />
                    Accessible
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Quick Register Location Form */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                Register Campus Place
              </span>
              {clickedLatLng ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-emerald-400" />
                  {clickedLatLng.lat.toFixed(5)}, {clickedLatLng.lng.toFixed(5)}
                </span>
              ) : (
                <span className="text-[10px] text-slate-500">Click map to target</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Code (e.g. GYM)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              >
                <option value="academic">Academic</option>
                <option value="administrative">Administrative</option>
                <option value="dining">Dining / Food</option>
                <option value="dormitory">Dormitory</option>
                <option value="sports">Athletics / Sports</option>
                <option value="other">Other Facility</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Building Name (e.g. Student Gymnasium)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
            />

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-medium">
                Connect to Road Network (Optional):
              </label>
              <select
                value={connectToRoadId}
                onChange={(e) => setConnectToRoadId(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              >
                <option value="">-- No Direct Road Link --</option>
                {campus.nodes.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label} ({n.id})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleRegisterLocation}
              disabled={!clickedLatLng}
              className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                clickedLatLng
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Register Place & Entrance</span>
            </button>
          </div>

          {/* Building Form */}
          {mode === 'building' && (
            <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
                  <Shapes className="w-3.5 h-3.5" />
                  Building Polygon ({currPolygon.length} corners)
                </span>
                {currPolygon.length > 0 && (
                  <button
                    onClick={() => setCurrPolygon((prev) => prev.slice(0, -1))}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Undo Corner
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Block Code (e.g. STEM, SOEEC)"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
              />
              <input
                type="text"
                placeholder="Building Name (e.g. STEM Center)"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleFinishBuilding}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1.5 px-3 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Footprint</span>
                </button>
                <button
                  onClick={() => setCurrPolygon([])}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-slate-200 cursor-pointer transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Direct Lat/Lng Input Box */}
          <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <LocateFixed className="w-3.5 h-3.5 text-slate-400" />
              <span>Manual Coordinate Entry</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Latitude (e.g. 8.5639)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
              />
              <input
                type="text"
                placeholder="Longitude (e.g. 39.2887)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors font-mono"
              />
            </div>
            <input
              type="text"
              placeholder="Landmark / Road Label (e.g. STEM Junction)"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 transition-colors"
            />
            <button
              onClick={handleAddManualNode}
              className="bg-slate-800 hover:bg-slate-700 border border-slate-700 py-1.5 rounded-lg text-xs font-medium text-slate-200 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span>Add Node to Map</span>
            </button>
          </div>

          {/* Telemetry & Stats Strip */}
          <div className="font-mono text-[11px] text-slate-400 flex items-center justify-between bg-slate-950/80 p-2.5 rounded-xl border border-slate-800/80">
            <span className="flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Buildings:</span>
              <strong className="text-slate-200 font-semibold">{campus.buildings.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>Nodes:</span>
              <strong className="text-slate-200 font-semibold">{campus.nodes.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5 text-indigo-400" />
              <span>Edges:</span>
              <strong className="text-slate-200 font-semibold">{campus.edges.length}</strong>
            </span>
          </div>
        </div>

        {/* Right Side: Satellite Map Canvas Frame */}
        <div
          className={`bg-slate-900/60 border border-slate-800 rounded-2xl p-1.5 shadow-xl transition-all duration-300 ${
            isFullScreen
              ? 'fixed inset-3 z-50 col-span-12 h-[calc(100vh-1.5rem)] min-h-none ring-2 ring-cyan-500/40 bg-slate-950'
              : 'lg:col-span-8 min-h-[600px] relative'
          }`}
        >
          {isFullScreen && (
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 right-4 z-[1000] bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white font-medium text-xs px-3.5 py-2 rounded-xl shadow-xl flex items-center gap-2 cursor-pointer transition-colors backdrop-blur-sm"
            >
              <Minimize2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Exit Fullscreen</span>
            </button>
          )}

          <DigitizeMapClient
            campus={campus}
            mode={mode}
            currPolygon={currPolygon}
            selectedSourceNode={selectedSourceNode}
            onAddMapClick={handleAddMapClick}
            onNodeClick={handleNodeClick}
            onDeleteNode={handleDeleteNode}
            onDeleteEdge={handleDeleteEdge}
          />
        </div>
      </div>
    </div>
  );
}

