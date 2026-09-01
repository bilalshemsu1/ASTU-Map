"use client";

import { useMemo, useRef, useState } from "react";
import { searchCampus, type SearchResult } from "@/lib/search";
import { campus } from "@/lib/graph";

type Props = {
  target: "start" | "end";
  onClose: () => void;
  onSelect: (result: SearchResult, asStart: boolean) => void;
};

export default function SearchOverlay({ target, onClose, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(
    () =>
      query.trim()
        ? searchCampus(query)
        : campus.pois.map((p) => ({ poi: p, room: undefined, score: 0 })),
    [query],
  );

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-white">
      <div className="flex items-center gap-2 border-b border-[#DADCE0] px-2 py-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#5F6368] hover:bg-[#F1F3F4]"
          aria-label="Back"
        >
          ‹
        </button>
        <input
          ref={inputRef}
          autoFocus
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              onSelect(results[active], target === "start");
            } else if (e.key === "Escape") {
              onClose();
            }
          }}
          placeholder="Search campus…"
          className="h-9 flex-1 rounded-full bg-[#F1F3F4] px-4 text-[15px] text-[#202124] outline-none placeholder:text-[#80868B]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3 text-xs font-medium uppercase tracking-wide text-[#80868B]">
          {query.trim() === ""
            ? `Tap a place to set ${target === "start" ? "your starting point" : "the destination"}`
            : results.length === 0
              ? `No matches for “${query}”`
              : `${results.length} ${results.length === 1 ? "match" : "matches"}`}
        </div>
        {results.length > 0 ? (
          <ul>
            {results.map((r, i) => (
              <li key={r.poi.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r, target === "start")}
                  onMouseEnter={() => setActive(i)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                    i === active ? "bg-[#F1F3F4]" : ""
                  }`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F3F4] text-[#5F6368]">
                    <LocationIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-medium text-[#202124]">
                      {r.poi.name}
                    </span>
                    <span className="block truncate text-[13px] text-[#5F6368]">
                      {r.room
                        ? `Room ${r.room.number}`
                        : r.poi.kind === "building"
                          ? "Building"
                          : r.poi.kind}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-4 py-6 text-sm text-[#80868B]">
            No matches for “{query}”. Check the spelling or try a room number.
          </div>
        )}
      </div>
    </div>
  );
}

function LocationIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"
        fill="currentColor"
      />
    </svg>
  );
}
