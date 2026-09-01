'use client';

import React, { useState, useEffect } from 'react';
import { CampusData, Building, Room, PathNode } from '../lib/types/map';
import { searchCampus, SearchResult } from '../lib/utils/search';

interface SearchBoxProps {
  campusData: CampusData;
  onSelectStart: (nodeId: string, label: string) => void;
  onSelectDestination: (building: Building, room?: Room) => void;
  startLabel: string;
  destLabel: string;
  onSwap?: () => void;
}

export default function SearchBox({
  campusData,
  onSelectStart,
  onSelectDestination,
  startLabel,
  destLabel,
  onSwap,
}: SearchBoxProps) {
  const [activeField, setActiveField] = useState<'start' | 'dest' | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
    } else {
      setResults(searchCampus(query, campusData));
    }
  }, [query, campusData]);

  const handleSelectBuilding = (res: SearchResult) => {
    if (activeField === 'dest') {
      onSelectDestination(res.building, res.matchingRoom);
    } else if (activeField === 'start') {
      const nodeLabel = res.matchingRoom
        ? `${res.building.code} - ${res.matchingRoom.name}`
        : res.building.name;
      onSelectStart(res.building.entranceNodeId, nodeLabel);
    }
    setActiveField(null);
    setQuery('');
  };

  const handleSelectPresetNode = (node: PathNode) => {
    if (activeField === 'start') {
      onSelectStart(node.id, node.label || `Node ${node.id}`);
    }
    setActiveField(null);
    setQuery('');
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg text-slate-100 flex flex-col gap-3">
      {/* Start Location Input */}
      <div className="relative">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
          From (Start Location)
        </label>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-emerald-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search start building, room, or gate..."
            value={activeField === 'start' ? query : startLabel}
            onFocus={() => {
              setActiveField('start');
              setQuery('');
            }}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-sm w-full outline-none text-slate-100 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Destination Input */}
      <div className="relative">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1 block">
          To (Destination)
        </label>
        <div className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
          <span className="w-3 h-3 rounded-full bg-rose-500 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search e.g. Block 7, Room 204, Library..."
            value={activeField === 'dest' ? query : destLabel}
            onFocus={() => {
              setActiveField('dest');
              setQuery('');
            }}
            onChange={(e) => setQuery(e.target.value)}
            className="bg-transparent text-sm w-full outline-none text-slate-100 placeholder-slate-500"
          />
        </div>
      </div>

      {/* Search Results Dropdown */}
      {activeField && (
        <div className="bg-slate-950 border border-slate-700 rounded-lg max-h-60 overflow-y-auto divide-y divide-slate-800 shadow-xl mt-1">
          {/* Quick preset locations for Start point */}
          {activeField === 'start' && !query && (
            <div className="p-2">
              <p className="text-xs text-slate-400 px-2 py-1 font-semibold">Campus Landmarks</p>
              {campusData.nodes
                .filter((n) => n.label)
                .map((n) => (
                  <div
                    key={n.id}
                    onClick={() => handleSelectPresetNode(n)}
                    className="px-3 py-2 text-xs hover:bg-slate-800 rounded cursor-pointer flex justify-between items-center text-slate-300"
                  >
                    <span>📍 {n.label}</span>
                    <span className="text-slate-500">Preset</span>
                  </div>
                ))}
            </div>
          )}

          {/* Search match items */}
          {results.length > 0 ? (
            results.map((res, idx) => (
              <div
                key={idx}
                onClick={() => handleSelectBuilding(res)}
                className="px-4 py-3 hover:bg-slate-800/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sky-400 text-sm">{res.building.name}</span>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-400">
                    {res.building.code}
                  </span>
                </div>
                {res.matchingRoom && (
                  <p className="text-xs text-emerald-400 mt-0.5">
                    🚪 Matched Room: <span className="font-semibold">{res.matchingRoom.name}</span>
                  </p>
                )}
                {res.building.aliases.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Also known as: {res.building.aliases.join(', ')}
                  </p>
                )}
              </div>
            ))
          ) : (
            query.trim() !== '' && (
              <div className="p-4 text-center text-xs text-slate-500">
                No matching buildings or rooms found for &quot;{query}&quot;
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
