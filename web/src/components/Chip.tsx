"use client";

/**
 * Chip — Figma 15:1030 系完全準拠
 * default: bg sumi-0 #0B0B0B / border offwhite-1 #FAF6EE / text offwhite-1 Regular 14 leading 1.7
 * selected: bg transparent / border red-on-dark #FF614A / text red-on-dark Bold 16 leading 1.4
 * 共通: rounded-8, px-16 py-10
 */
type ChipProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
};

export default function Chip({ label, selected, onClick }: ChipProps) {
  const base =
    "font-sans px-4 py-[10px] rounded-[8px] border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent";
  const variant = selected
    ? "border-red-on-dark text-red-on-dark text-[16px] font-bold leading-[1.4] bg-transparent"
    : "bg-sumi-0 border-offwhite-1 text-offwhite-1 text-[14px] font-normal leading-[1.7]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`${base} ${variant}`}
    >
      {label}
    </button>
  );
}
