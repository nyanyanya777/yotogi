"use client";

/**
 * Chip — Figma component set 137:90 完全準拠（Default / Hover / Selected / Disabled）。
 *
 *   - Default : bg sumi-0 #0B0B0B / border offwhite-1 #FAF6EE / text offwhite-1 Regular 14
 *   - Hover   : bg sumi-0        / border red-on-dark #FF614A / text offwhite-1 Medium 14
 *   - Selected: border red-on-dark #FF614A                    / text red-on-dark  Bold 16
 *   - Disabled: bg sumi-0 / border sumi-3 #A09890 / text sumi-3 Regular 14 / opacity 45%
 *   - 共通    : rounded-8, px-16 py-10
 *
 * 色はすべてセマンティックトークン経由（直書き hex 無し）。
 */
type ChipProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  /** 3 つ選択済みで未選択チップを押せなくする等。Disabled 状態に対応。 */
  disabled?: boolean;
};

export default function Chip({ label, selected, onClick, disabled = false }: ChipProps) {
  const base =
    "font-sans px-4 py-[10px] rounded-[8px] border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent";

  let variant: string;
  if (disabled) {
    // Disabled — ミュート + opacity 45%
    variant =
      "bg-sumi-0 border-sumi-3 text-sumi-3 text-[14px] font-normal leading-[1.7] opacity-45 cursor-not-allowed";
  } else if (selected) {
    // Selected — 赤枠 + 赤文字 + 淡い赤地で区別。
    // 文字サイズ/ウェイトは Default と同一(14px / normal)に固定する。
    // 以前は 16px Bold に変えていたが、選択のたびにチップ幅が伸縮して
    // グリッド全体がリフローし「タグの大きさが変わって違和感」状態だった。
    variant =
      "bg-red-on-dark/15 border-red-on-dark text-red-on-dark text-[14px] font-normal leading-[1.7]";
  } else {
    // Default → Hover（hover は枠色のみ変える。font-weight は変えない＝幅が動かない）
    variant =
      "bg-sumi-0 border-offwhite-1 text-offwhite-1 text-[14px] font-normal leading-[1.7] hover:border-red-on-dark";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={`${base} ${variant}`}
    >
      {label}
    </button>
  );
}
