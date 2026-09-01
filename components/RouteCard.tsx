"use client";

import type { Turn } from "@/lib/turns";

type Props = {
  meters: number;
  turns: Turn[];
  fromLabel?: string;
  toLabel?: string;
};

const PACE_MPH = 3.0;

export default function RouteCard({ meters, turns, fromLabel, toLabel }: Props) {
  const minutes = Math.max(1, Math.round((meters / (PACE_MPH * 1609.34)) * 60));
  const display = meters.toFixed(0) + " m";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-2xl font-bold text-[#202124]">{minutes} min</span>
        <span className="text-sm text-[#5F6368]">({display})</span>
      </div>
      <p className="-mt-1 text-sm text-[#5F6368]">
        Fastest walking route{toLabel ? ` to ${toLabel}` : ""}
      </p>

      <button
        type="button"
        className="mt-1 h-11 w-full rounded-full bg-[#4285F4] text-[15px] font-medium text-white shadow-[0_2px_6px_rgba(0,0,0,0.2)] hover:bg-[#1A73E8] active:scale-[0.98]"
      >
        Start
      </button>

      {(fromLabel || toLabel) && (
        <p className="text-xs text-[#80868B]">
          {fromLabel}
          {fromLabel && toLabel && " → "}
          {toLabel}
        </p>
      )}

      {turns.length > 0 && (
        <ol className="mt-1 space-y-3 border-t border-[#DADCE0] pt-3">
          {turns.map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F1F3F4] text-xs font-semibold text-[#5F6368]">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] text-[#202124]">{t.text}</p>
                {t.meters > 0 && (
                  <p className="text-xs text-[#80868B]">{t.meters.toFixed(0)} m</p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {turns.length === 0 && (
        <p className="text-sm text-[#5F6368]">You are already there.</p>
      )}
    </div>
  );
}
