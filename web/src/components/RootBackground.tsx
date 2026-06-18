"use client";

import { usePathname } from "next/navigation";

/**
 * RootBackground — 実 viewport を物理的に 100% 覆う「地」の層。
 *
 * 役割: body の不透明黒に依存せず、`position: fixed; inset: 0` で地を敷き、
 * オーバースクロール(ゴムバンド)・ツールバー収縮・dvh 差・safe-area・
 * scrollbar-gutter まで含めて純黒(#0b0b0b body)露出を封じる。
 *
 * 額装モデルの地色の使い分け:
 *   - ≥440px(PC/wide): 全ルート共通で墨(sumi-0)。周囲(surround)は全ルートで
 *     暗い浮世絵(BackgroundLayer)なので、その下地は常に墨でよい。昼ルート
 *     (/folklore)でもここはクリームにしない — クリーム(和紙)はコラム内だけに
 *     閉じ、「viewport 全面がクリームの海」状態を防ぐ。
 *   - <440px(モバイル): BackgroundLayer 非表示でコラムが全幅。地はページの
 *     テーマ色(夜=墨 / 昼=和紙)にし、scrollbar-gutter/overscroll の細い帯まで
 *     コラムと同色にする＝モバイルの見えは従来どおり(昼は和紙のまま)。
 *
 * 2 枚重ねで実現する: 墨を常時敷き(PC 下地 ＆ 黒露出の最終防壁)、その上に
 * 昼ルートだけ <440px で和紙を重ねる(min-[440px]:hidden)。直 hex 禁止(トークン経由)。
 *
 * 重なり順: 墨地/和紙地(-z-10) < BackgroundLayer 浮世絵(z-0)/暗幕(z-1) < 額装コラム。
 */
export default function RootBackground() {
  const pathname = usePathname();
  const day = pathname === "/folklore";
  return (
    <>
      {/* 最終防壁＆PC 下地 — 全ルート/全幅で墨。黒露出を物理的に封じる。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-sumi-0"
      />
      {/* 昼ルートのモバイル地 — <440px だけ和紙を重ね、ガター/overscroll まで和紙。
          ≥440px では消し(min-[440px]:hidden)、周囲は暗い surround のままにする。 */}
      {day && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 -z-10 bg-offwhite-0 min-[440px]:hidden"
        />
      )}
    </>
  );
}
