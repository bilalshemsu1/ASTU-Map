"use client";

type Props = {
  onClick: () => void;
  toLabel?: string;
};

export default function TopSearch({ onClick, toLabel }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-2 right-2 top-2 z-20 flex h-12 items-center gap-3 rounded-full bg-white px-4 shadow-[0_2px_8px_rgba(0,0,0,0.15)] sm:left-auto sm:right-auto sm:w-[340px]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="#5F6368">
        <path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z" />
      </svg>
      <span
        className={`truncate text-[16px] ${toLabel ? "font-medium text-[#202124]" : "text-[#5F6368]"}`}
      >
        {toLabel ?? "Where to?"}
      </span>
    </button>
  );
}
