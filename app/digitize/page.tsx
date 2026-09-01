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

  const handleAddMapClick = (latlng: LatLng) => {
    if (mode === 'building') {
      setCurrPolygon((prev) => [...prev, latlng]);
    } else if (mode === 'node') {
      const newNode: PathNode = {
        id: `n_${Date.now().toString().slice(-5)}`,
        lat: Number(latlng.lat.toFixed(6)),
        lng: Number(latlng.lng.toFixed(6)),
        label: `Point (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`,
      };
      setCampus((prev) => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-sky-400">ASTU Lat/Lng Satellite Digitizer</h1>
          <p className="text-sm text-slate-400">
            Click directly on the satellite map or enter Latitude & Longitude coordinates to place buildings and walking nodes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors text-slate-300"
          >
            ← Back to Map Navigator
          </a>
          <button
            onClick={exportJSON}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg"
          >
            💾 Export campus.json
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Controls */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">
              Action Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['view', 'building', 'node', 'edge'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => {
                    setMode(m);
                    setSelectedSourceNode(null);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors ${
                    mode === m
                      ? 'bg-sky-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {m === 'building' ? 'Trace Building' : m === 'edge' ? 'Connect Path' : m}
                </button>
              ))}
            </div>
          </div>

          {/* Building Form */}
          {mode === 'building' && (
            <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
              <span className="text-xs text-sky-400 font-semibold">
                Click map to add polygon Lat/Lng points ({currPolygon.length} corners added)
              </span>
              <input
                type="text"
                placeholder="Building Code (e.g. B7)"
                value={bCode}
                onChange={(e) => setBCode(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 outline-none"
              />
              <input
                type="text"
                placeholder="Building Name (e.g. Electrical Eng)"
                value={bName}
                onChange={(e) => setBName(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 outline-none"
              />
              <div className="flex gap-2 mt-1">
                <button
                  onClick={handleFinishBuilding}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1.5 rounded text-xs font-medium text-white"
                >
                  Save Building
                </button>
                <button
                  onClick={() => setCurrPolygon([])}
                  className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-xs text-slate-400"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Direct Lat/Lng Input Box */}
          <div className="border-t border-slate-800 pt-3 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-300">
              📍 Direct Lat/Lng Coordinate Entry
            </span>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Latitude (e.g. 8.8853)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 outline-none"
              />
              <input
                type="text"
                placeholder="Longitude (e.g. 38.8105)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 outline-none"
              />
            </div>
            <input
              type="text"
              placeholder="Landmark Label (Optional)"
              value={manualLabel}
              onChange={(e) => setManualLabel(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-xs text-slate-100 outline-none"
            />
            <button
              onClick={handleAddManualNode}
              className="bg-sky-600 hover:bg-sky-500 py-1.5 rounded text-xs font-medium text-white"
            >
              Add Node by Lat/Lng
            </button>
          </div>

          <div className="border-t border-slate-800 pt-3 text-xs text-slate-400 flex justify-between">
            <span>Buildings: {campus.buildings.length}</span>
            <span>Nodes: {campus.nodes.length}</span>
            <span>Edges: {campus.edges.length}</span>
          </div>
        </div>

        {/* Satellite Map */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-2 min-h-[550px]">
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
