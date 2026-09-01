"use client";

type Props = {
  active?: boolean;
  onClick: () => void;
  pressed: boolean;
};

export default function DirectionsFab({ active = true, onClick, pressed }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="Set destination on map"
      aria-pressed={pressed}
      className={`absolute bottom-4 right-4 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.2)] transition-transform active:scale-95 ${
        pressed ? "bg-[#1A73E8]" : active ? "bg-[#4285F4]" : "opacity-50"
      }`}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
        <path d="M12 2l1.2 3.5L16.5 4l1.5 3.2 3.8-.4-1 3.7 3 .7-2.6 2.8 3 1.6-2.9 2.5 2.2 3.1H12.5L11 20 8.5 22 7 18.7 3 20l1.5-3.6-3-.9 2.6-2.5-2.9-2 3.2-1.6L4 6l3.7.5L9 3l3.5 1.7L12 2z"
        />
      </svg>
    </button>
  );
}
