"use client";

type Props = {
  fromLabel: string;
  toLabel: string;
  onSwap: () => void;
  onEditDestination: () => void;
  onClose: () => void;
};

export default function DirectionsBar({
  fromLabel,
  toLabel,
  onSwap,
  onEditDestination,
  onClose,
}: Props) {
  return (
    <div className="absolute left-2 right-2 top-2 z-20 flex items-start gap-2 rounded-2xl bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.15)] sm:left-auto sm:right-auto sm:w-[340px]">
      <button
        type="button"
        onClick={onSwap}
        title="Swap start and destination"
        className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1F3F4] text-[#5F6368] hover:bg-[#E8EAED]"
        aria-label="Swap"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M13 5.5L18 10H7V8h8.4L13 5.5zM11 18.5L6 14h11v2H8.6l2.4 2.5z" />
        </svg>
      </button>

      <div className="min-w-0 flex-1">
        <Field
          dot="#4285F4"
          label={fromLabel}
          onClick={onEditDestination}
          editable
        />
        <div className="my-1 h-px bg-[#DADCE0]" />
        <Field dot="#DC2626" label={toLabel} onClick={onEditDestination} editable />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#5F6368] hover:bg-[#F1F3F4]"
        aria-label="Close directions"
      >
        ×
      </button>
    </div>
  );
}

function Field({
  dot,
  label,
  onClick,
  editable,
}: {
  dot: string;
  label: string;
  onClick: () => void;
  editable: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left hover:bg-[#F1F3F4]"
    >
      <span
        className="h-3 w-3 shrink-0 rounded-full border-2 border-white shadow"
        style={{ background: dot }}
      />
      <span className="truncate text-[15px] text-[#202124]">{label}</span>
      {editable && <span className="sr-only">Edit</span>}
    </button>
  );
}
