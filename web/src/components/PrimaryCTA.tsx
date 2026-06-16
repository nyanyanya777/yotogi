"use client";

/**
 * PrimaryCTA — Figma 11:182 / 15:1078 準拠の赤 pill ボタン。
 * bg color/red/accent #D91C0B / text color/offwhite/1-surface #FAF6EE / Noto Sans JP Bold 16
 * h:48 / rounded:24 / max-w 360 / min-w 132 / px:16
 * splash: 既定 343px、motif: fullWidth (370px)
 * disabled は opacity ダウン
 */
type PrimaryCTAProps = {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  fullWidth?: boolean;
};

export default function PrimaryCTA({
  label,
  onClick,
  disabled = false,
  fullWidth = false,
}: PrimaryCTAProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-12 text-[16px] font-bold rounded-[24px] px-4",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent",
        disabled
          ? "bg-red-accent/40 text-offwhite-1/70 cursor-not-allowed"
          : "bg-red-accent text-offwhite-1 cursor-pointer",
        fullWidth ? "w-full max-w-[360px]" : "w-[343px] max-w-[360px]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
