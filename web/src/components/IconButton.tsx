import type { ReactNode } from "react";

type IconButtonProps = {
  /**
   * Accessible label for the button (visually hidden).
   */
  label: string;
  /**
   * SVG icon. Should use `currentColor` for stroke/fill so it inherits text color.
   */
  children: ReactNode;
  /**
   * Optional click handler.
   */
  onClick?: () => void;
  /**
   * Optional className to override stroke color (e.g. `text-sumi-3`).
   */
  className?: string;
};

/**
 * IconButton — 44×44 タップ領域の汎用アイコンボタン。
 * 中身は SVG を `children` で受け取り、`currentColor` で色追従させる。
 * stroke 2px / linecap=round / linejoin=round はアイコン側で指定する。
 */
export default function IconButton({
  label,
  children,
  onClick,
  className = "",
}: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full bg-transparent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent ${className}`}
    >
      {children}
    </button>
  );
}
