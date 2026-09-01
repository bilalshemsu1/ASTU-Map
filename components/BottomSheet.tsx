"use client";

import { useRef } from "react";

type Props = {
  open: boolean;
  peek: string;
  expanded: string;
  isExpanded: boolean;
  onToggle: (expanded: boolean) => void;
  onClose: () => void;
  children: React.ReactNode;
};

export default function BottomSheet({
  open,
  peek,
  expanded,
  isExpanded,
  onToggle,
  onClose,
  children,
}: Props) {
  const start = useRef<{ y: number; state: boolean } | null>(null);
  const height = (isExpanded ? expanded : peek) as string;
  if (!open) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    start.current = { y: e.clientY, state: isExpanded };
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!start.current) return;
    const dy = e.clientY - start.current.y;
    const draggingDown = dy > 0;
    onToggle(draggingDown ? false : true);
    start.current = null;
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30">
      <div
        className="pointer-events-auto mx-auto flex w-full max-w-6xl flex-col overflow-hidden rounded-t-2xl border-t border-slate-200 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.12)] transition-[height] duration-200"
        style={{ height }}
      >
        <button
          type="button"
          className="flex shrink-0 touch-none cursor-grab items-center justify-center py-2 active:cursor-grabbing"
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (start.current = null)}
          aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
        >
          <span className="h-1 w-8 rounded-full bg-[#DADCE0]" />
        </button>
        <div className="flex shrink-0 items-center justify-between px-4 pb-1">
          <div className="text-xs text-[#5F6368]">
            {isExpanded ? "Swipe down to collapse" : "Swipe up for directions"}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center rounded-full bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{children}</div>
      </div>
    </div>
  );
}
