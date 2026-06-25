"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * PrimaryCTA — yotogi の主要 CTA を一元化する pill ボタン。
 *
 * 統一仕様（全 CTA 共通の寸法・形）:
 *   高さ   : h-12 (48px)
 *   横幅   : w-full（左右マージンは各ページのコンテナ依存）
 *   角丸   : rounded-full (pill)
 *   余白   : px-4
 *   文字   : Noto Sans JP Bold 16 / 中央寄せ / leading 1.4
 *
 * variant で色のセマンティクスだけを切り替える（寸法は不変）:
 *   primary   … bg red-accent  / text offwhite-1（夜の主導線・赤）
 *   secondary … bg offwhite-2  / text sumi-1（オフホワイト面の副導線）
 *   ghost     … 透明 / text red-on-dark（夜のテキストボタン）
 *
 * 色トークンはすべて globals.css のセマンティック変数経由（直書き hex 無し）。
 *
 * href を渡すと next/link、渡さなければ <button>。disabled は opacity ダウン。
 */
type Variant = "primary" | "secondary" | "ghost";

type CommonProps = {
  label: string;
  variant?: Variant;
  className?: string;
};

type ButtonProps = CommonProps & {
  href?: undefined;
  onClick?: () => void;
  disabled?: boolean;
};

type LinkProps = CommonProps & {
  href: string;
  onClick?: () => void;
};

type PrimaryCTAProps = ButtonProps | LinkProps;

// 全 variant 共通の寸法・形。ここが「統一仕様」の単一の出どころ。
const BASE =
  "flex h-12 w-full items-center justify-center rounded-full px-4 " +
  "text-[16px] font-bold leading-[1.4] text-center transition-colors duration-150 " +
  "focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2";

const VARIANT: Record<Variant, string> = {
  primary:
    "bg-red-accent text-offwhite-1 hover:bg-red-accent/90 focus-visible:outline-red-accent",
  secondary:
    "bg-offwhite-2 text-sumi-1 hover:bg-offwhite-2/90 focus-visible:outline-offwhite-2",
  ghost:
    "bg-transparent text-red-on-dark hover:opacity-80 focus-visible:outline-red-on-dark",
};

const DISABLED: Record<Variant, string> = {
  primary: "bg-red-accent/40 text-offwhite-1/70 cursor-not-allowed",
  secondary: "bg-offwhite-2/40 text-sumi-1/60 cursor-not-allowed",
  ghost: "text-red-on-dark/50 cursor-not-allowed",
};

export default function PrimaryCTA(props: PrimaryCTAProps): ReactNode {
  const { label, variant = "primary", className = "" } = props;

  if (props.href !== undefined) {
    return (
      <Link
        href={props.href}
        onClick={props.onClick}
        className={[BASE, VARIANT[variant], className].join(" ")}
      >
        {label}
      </Link>
    );
  }

  const disabled = props.disabled ?? false;
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={disabled}
      className={[
        BASE,
        disabled ? DISABLED[variant] : VARIANT[variant],
        className,
      ].join(" ")}
    >
      {label}
    </button>
  );
}
