'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { CampusData, Building, PathNode, PathEdge, LatLng } from '../../lib/types/map';
import initialCampusData from '../../lib/data/campus.json';

const DigitizeMapClient = dynamic(() => import('./DigitizeMapClient'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[500px] bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-slate-400 text-sm">
      <span>Loading Digitizer Satellite Map...</span>
    </div>
  ),
});

export default function DigitizePage() {
  const [campus, setCampus] = useState<CampusData>(initialCampusData as CampusData);
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

    alert(`Auto-connected ${addedCount} building entrance nodes to their nearest road points! 🎉`);
  };

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
    <div className="min-h-screen bg-[#030712] text-slate-100 p-4 md:p-6 flex flex-col gap-5 font-sans relative selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Top Cyber Command Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800/80 p-4 rounded-2xl shadow-2xl relative overflow-hidden">
        {/* Subtle Ambient Glow Effect */}
        <div className="absolute -top-10 -left-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center gap-3.5 z-10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-lg shadow-cyan-500/20 ring-1 ring-white/20">
            📡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-indigo-300">
                ASTU Cartography Command Center
              </h1>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 border border-cyan-800/80 text-cyan-300 tracking-wider uppercase">
                v3.2 Studio
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              <span>Precision GIS Node & Walkway Digitizer Studio</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-emerald-400 font-mono font-bold">Live Grid Connected</span>
            </p>
          </div>
        </div>

        {/* Top Control Actions Bar */}
        <div className="flex items-center gap-2.5 flex-wrap z-10">
          <button
            onClick={handleAutoConnectBuildingNodes}
            title="Automatically snap and connect every building entrance node to its nearest drawn road point!"
            className="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-purple-500/20 flex items-center gap-2 cursor-pointer ring-1 ring-purple-400/30 hover:scale-105 active:scale-95"
          >
            <span>⚡ Auto-Connect Entrances</span>
          </button>

          <button
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 rounded-xl font-bold text-xs transition-all shadow flex items-center gap-1.5 cursor-pointer hover:border-slate-600"
          >
            <span>{isFullScreen ? '📉 Exit Fullscreen' : '🖥️ Fullscreen Canvas'}</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <button
            onClick={handleUndoLastNode}
            title="Undo last added road/entrance node point"
            className="px-3 py-2 bg-amber-950/40 hover:bg-amber-900/60 border border-amber-700/60 text-amber-300 rounded-xl font-bold text-xs transition-all shadow flex items-center gap-1.5 cursor-pointer"
          >
            <span>↩️ Undo Point</span>
          </button>

          <button
            onClick={handleUndoLastEdge}
            title="Undo last added road edge connection"
            className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl font-bold text-xs transition-all shadow flex items-center gap-1.5 cursor-pointer"
          >
            <span>🔗 Undo Link</span>
          </button>

          <div className="h-5 w-[1px] bg-slate-800 hidden sm:block" />

          <a
            href="/"
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800/90 rounded-xl text-xs font-bold transition-all text-slate-300 border border-slate-800 flex items-center gap-1.5"
          >
            ← Navigator
          </a>

          <button
            onClick={exportJSON}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-2 cursor-pointer hover:scale-105 active:scale-95"
          >
            <span>💾 Export campus.json</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-2xl">
          {/* Step Guidance Card */}
          <div className="bg-sky-950/60 border border-sky-800/80 rounded-xl p-3.5 text-xs text-sky-200 leading-relaxed">
            <strong className="text-sky-300 block font-bold mb-1">🚗 Continuous Road & Building Setup:</strong>
            {mode === 'node' && (
              <div>
                <span>Simply click along any campus road on the satellite map. The system automatically connects consecutive points into a continuous road path!</span>
                {lastRoadNodeId && (
                  <button
                    onClick={() => setLastRoadNodeId(null)}
                    className="mt-2 text-[11px] bg-amber-600/90 hover:bg-amber-500 text-white px-2.5 py-1 rounded-lg font-bold block cursor-pointer"
                  >
                    Start New Separate Road Segment ✂️
                  </button>
                )}
              </div>
            )}
            {mode === 'view' && 'Click anywhere on the satellite map to capture Lat & Lng coordinates for registering a building or location!'}
            {mode === 'edge' && 'Click Node A then Node B on the map to build custom connections between road waypoints or building entrances.'}
            {mode === 'building' && 'Click 3 or more corners on the satellite map to outline a building polygon.'}
          </div>

          <div>
            <label className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2.5">
              ACTIVE DIGITIZER TOOL MODE
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'view', label: '📍 Click & Register', desc: 'Auto Lat/Lng capture', icon: '📍', color: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/50 text-cyan-300 ring-cyan-500/30' },
                { id: 'node', label: '🛣️ Draw Campus Roads', desc: 'Auto-connect line', icon: '🛣️', color: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/50 text-emerald-300 ring-emerald-500/30' },
                { id: 'edge', label: '🔗 Custom Connection', desc: 'Link any 2 points', icon: '🔗', color: 'from-purple-500/20 to-indigo-500/20 border-purple-500/50 text-purple-300 ring-purple-500/30' },
                { id: 'edit', label: '✏️ Edit & Delete', desc: 'Inspect & remove', icon: '✏️', color: 'from-amber-500/20 to-orange-500/20 border-amber-500/50 text-amber-300 ring-amber-500/30' },
                { id: 'building', label: '🏢 Trace Polygon', desc: 'Outline block', icon: '🏢', color: 'from-blue-500/20 to-sky-500/20 border-blue-500/50 text-blue-300 ring-blue-500/30' },
              ].map((m) => {
                const isActive = mode === m.id;
                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMode(m.id as any);
                      setSelectedSourceNode(null);
                      setLastRoadNodeId(null);
                    }}
                    className={`p-3 rounded-xl text-left border transition-all cursor-pointer relative overflow-hidden ${
                      isActive
                        ? `bg-gradient-to-br ${m.color} text-white shadow-xl ring-2 shadow-cyan-500/10`
                        : 'bg-slate-900/90 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                    )}
                    <div className="font-bold text-xs flex items-center gap-1.5">{m.label}</div>
                    <div className="text-[10px] opacity-70 mt-0.5 font-mono">{m.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Edge Customization Controls */}
          {(mode === 'node' || mode === 'edge') && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-col gap-2 text-xs">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                ⚙️ Custom Road Edge Properties
              </span>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] text-slate-400 font-bold">Road Surface / Path Type:</label>
                <select
                  value={roadType}
                  onChange={(e) => setRoadType(e.target.value as any)}
                  className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none focus:border-sky-500"
                >
                  <option value="paved_walkway">🚶 Paved Pedestrian Walkway</option>
                  <option value="asphalt_road">🚗 Asphalt Vehicle Road</option>
                  <option value="dirt_path">🌿 Dirt / Grass Footpath</option>
                  <option value="stairs">🪜 Stairs / Steps (Slower speed penalty)</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="text-slate-300 flex items-center gap-2 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={isOneWay}
                    onChange={(e) => setIsOneWay(e.target.checked)}
                    className="accent-sky-500"
                  />
                  <span>Strictly One-Way Edge</span>
                </label>
                <label className="text-slate-300 flex items-center gap-2 cursor-pointer text-[11px]">
                  <input
                    type="checkbox"
                    checked={handicapAccessible}
                    onChange={(e) => setHandicapAccessible(e.target.checked)}
                    className="accent-emerald-500"
                  />
                  <span>♿ Accessible</span>
                </label>
              </div>
            </div>
          )}

          {/* Quick Register Location Form */}
          <div className="bg-slate-950/80 border border-sky-900/60 rounded-xl p-3.5 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1.5">
                <span>🏢 Quick Register New Location</span>
              </span>
              {clickedLatLng ? (
                <span className="text-[10px] bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded font-mono font-bold">
                  {clickedLatLng.lat.toFixed(5)}, {clickedLatLng.lng.toFixed(5)}
                </span>
              ) : (
                <span className="text-[10px] text-amber-400">Click map to select location</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Code (e.g. GYM)"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as any)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="academic">Academic</option>
                <option value="administrative">Administrative</option>
                <option value="dining">Dining / Cafe</option>
                <option value="dormitory">Dormitory</option>
                <option value="sports">Sports</option>
                <option value="other">Other</option>
              </select>
            </div>

            <input
              type="text"
              placeholder="Building Name (e.g. Student Gymnasium)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
            />

            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-slate-400 font-bold">
                Connect to Nearby Road Node (Optional):
              </label>
              <select
                value={connectToRoadId}
                onChange={(e) => setConnectToRoadId(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-2 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              >
                <option value="">-- No Immediate Road Link --</option>
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
              className={`py-2 rounded-xl text-xs font-bold text-white shadow transition-all cursor-pointer ${
                clickedLatLng
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              Register Location & Entrance Node
            </button>
          </div>

          {/* Building Form */}
          {mode === 'building' && (
            <div className="border-t border-slate-800 pt-4 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs text-amber-400 font-bold">
                  Building Corners: {currPolygon.length}
                </span>
                {currPolygon.length > 0 && (
                  <button
                    onClick={() => setCurrPolygon((prev) => prev.slice(0, -1))}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Undo Last Point
                  </button>
                )}
              </div>
              <input
                type="text"
                placeholder="Block Code (e.g. STEM, SOEEC)"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Building Name (e.g. STEM Center)"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleFinishBuilding}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-xl text-xs font-bold text-white shadow transition-all cursor-pointer"
                >
                  Save Building Polygon
                </button>
                <button
                  onClick={() => setCurrPolygon([])}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-xl text-xs text-slate-400 cursor-pointer"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Direct Lat/Lng Input Box */}
          <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>📍 Manual Lat/Lng Coordinate Input</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Latitude (e.g. 8.5639)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Longitude (e.g. 39.2887)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
            </div>
            <input
              type="text"
              placeholder="Landmark / Road Label (e.g. STEM Junction)"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
            <button
              onClick={handleAddManualNode}
              className="bg-sky-600 hover:bg-sky-500 py-1.5 rounded-xl text-xs font-bold text-white shadow transition-all cursor-pointer"
            >
              Add Node to Map
            </button>
          </div>

          <div className="border-t border-slate-800/80 pt-3 font-mono text-[11px] text-slate-300 flex items-center justify-between bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/50">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>🏢 Buildings:</span>
              <strong className="text-cyan-300">{campus.buildings.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>📍 Nodes:</span>
              <strong className="text-emerald-300">{campus.nodes.length}</strong>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-purple-400" />
              <span>🔗 Edges:</span>
              <strong className="text-purple-300">{campus.edges.length}</strong>
            </span>
          </div>
        </div>

        {/* Satellite Map */}
        <div
          className={`bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl transition-all duration-300 ${
            isFullScreen
              ? 'fixed inset-4 z-50 col-span-12 h-[calc(100vh-2rem)] min-h-none ring-4 ring-indigo-500/50'
              : 'lg:col-span-8 min-h-[600px] relative'
          }`}
        >
          {isFullScreen && (
            <button
              onClick={() => setIsFullScreen(false)}
              className="absolute top-4 right-4 z-[1000] bg-slate-950/90 hover:bg-slate-900 border border-slate-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2 cursor-pointer"
            >
              <span>📉 Exit Fullscreen (Esc)</span>
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

