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
  const [mode, setMode] = useState<'view' | 'building' | 'node' | 'edge'>('view');

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

  const handleAddMapClick = (latlng: LatLng) => {
    if (mode === 'building') {
      setCurrPolygon((prev) => [...prev, latlng]);
    } else if (mode === 'node') {
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

        // Auto-connect consecutive clicked points into a continuous road segment!
        if (lastRoadNodeId) {
          nextEdges.push({
            id: `e_${lastRoadNodeId}_${newNodeId}`,
            source: lastRoadNodeId,
            target: newNodeId,
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
        };
        setCampus((prev) => ({
          ...prev,
          edges: [...prev.edges, newEdge],
        }));
        setSelectedSourceNode(null);
      }
    }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 flex flex-col gap-6 font-sans">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-black text-sky-400 flex items-center gap-2">
            <span>🗺️ ASTU Interactive Satellite Road & Building Digitizer</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Easily trace real campus walkways, roads, and buildings on high-resolution satellite imagery.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold transition-all text-slate-300 border border-slate-700"
          >
            ← Back to Map Navigator
          </a>
          <button
            onClick={exportJSON}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer"
          >
            <span>💾 Export Updated campus.json</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls Panel */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col gap-5 shadow-2xl">
          {/* Step Guidance Card */}
          <div className="bg-sky-950/60 border border-sky-800/80 rounded-xl p-3.5 text-xs text-sky-200 leading-relaxed">
            <strong className="text-sky-300 block font-bold mb-1">🚗 Continuous Road Drawing:</strong>
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
            {mode === 'view' && 'Select "Draw Campus Roads" below to start tracing campus roads.'}
            {mode === 'edge' && 'Click Node A then Node B to link two existing road waypoints.'}
            {mode === 'building' && 'Click 3 or more corners on the satellite map to outline a building.'}
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2.5">
              Choose Action Tool
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { id: 'node', label: '🛣️ Draw Campus Roads', desc: 'Auto-connect line' },
                { id: 'edge', label: '🔗 Connect Nodes', desc: 'Link 2 points' },
                { id: 'view', label: '👀 View Map', desc: 'Inspect' },
                { id: 'building', label: '🏢 Trace Building', desc: 'Outline block' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    setMode(m.id as any);
                    setSelectedSourceNode(null);
                    setLastRoadNodeId(null);
                  }}
                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                    mode === m.id
                      ? 'bg-sky-600 border-sky-400 text-white shadow-lg ring-2 ring-sky-500/50'
                      : 'bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <div className="font-bold text-xs">{m.label}</div>
                  <div className="text-[10px] opacity-75 mt-0.5">{m.desc}</div>
                </button>
              ))}
            </div>
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
                  Save Building
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
          <div className="border-t border-slate-800 pt-4 flex flex-col gap-2.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>📍 Manual Lat/Lng Coordinate Input</span>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Latitude (e.g. 8.5639)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
              <input
                type="text"
                placeholder="Longitude (e.g. 39.2887)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
              />
            </div>
            <input
              type="text"
              placeholder="Landmark / Road Label (e.g. STEM Junction)"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 outline-none focus:border-sky-500"
            />
            <button
              onClick={handleAddManualNode}
              className="bg-sky-600 hover:bg-sky-500 py-2 rounded-xl text-xs font-bold text-white shadow transition-all cursor-pointer"
            >
              Add Node to Map
            </button>
          </div>

          <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-400 font-bold flex justify-between">
            <span>🏢 Buildings: {campus.buildings.length}</span>
            <span>📍 Nodes: {campus.nodes.length}</span>
            <span>🔗 Edges: {campus.edges.length}</span>
          </div>
        </div>

        {/* Satellite Map */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-2 min-h-[600px] shadow-2xl relative">
          <DigitizeMapClient
            campus={campus}
            mode={mode}
            currPolygon={currPolygon}
            selectedSourceNode={selectedSourceNode}
            onAddMapClick={handleAddMapClick}
            onNodeClick={handleNodeClick}
          />
        </div>
      </div>
    </div>
  );
}
