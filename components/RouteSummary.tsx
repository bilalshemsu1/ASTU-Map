'use client';

import React from 'react';
import { RouteResult } from '../lib/types/map';

interface RouteSummaryProps {
  routeResult: RouteResult | null;
  startLabel: string;
  destLabel: string;
}

export default function RouteSummary({ routeResult, startLabel, destLabel }: RouteSummaryProps) {
  if (!routeResult) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-center text-slate-400">
        <p className="text-sm">Select a start location and destination to see walking directions.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 text-slate-100 shadow-lg flex flex-col gap-4">
      {/* Route Header Metrics */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Est. Walking Time
          </span>
          <div className="text-2xl font-bold text-sky-400 mt-0.5">
            ~{routeResult.estimatedTimeMinutes} min
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
            Total Distance
          </span>
          <div className="text-2xl font-bold text-emerald-400 mt-0.5">
            {routeResult.totalDistanceMeters} m
          </div>
        </div>
      </div>

      {/* From / To Banner */}
      <div className="text-xs text-slate-300 bg-slate-800/60 p-3 rounded-lg flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <span>From: <strong className="text-slate-100">{startLabel}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-rose-500" />
          <span>To: <strong className="text-slate-100">{destLabel}</strong></span>
        </div>
      </div>

      {/* Turn-by-Turn Steps */}
      <div>
        <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
          Step-by-step walking guide ({routeResult.steps.length} steps)
        </h4>
        <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
          {routeResult.steps.map((step, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-xs"
            >
              <div className="w-5 h-5 rounded-full bg-sky-950 text-sky-400 border border-sky-800 flex items-center justify-center font-bold flex-shrink-0 text-[10px]">
                {idx + 1}
              </div>
              <div className="flex-1">
                <p className="text-slate-200 font-medium">{step.instruction}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{step.distanceMeters} meters</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
