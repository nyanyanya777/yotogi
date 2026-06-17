"use client";

import { usePathname } from "next/navigation";

/**
 * RootBackground — 実 viewport を物理的に 100% 覆う「地」の層。
 *
 * 役割: body の不透明黒に依存せず、各ルートに応じた地色を
 * `position: fixed; inset: 0` で敷き、オーバースクロール(ゴムバンド)・
 * ツールバー収縮・dvh 差・safe-area まで含めて黒の露出を封じる。
 *
 *   - 夜ルート(/ , /motif , /story) … sumi-0(墨)
 *   - /folklore                     … offwhite-0(昼の生成り)
 *   - /generating                   … ここでは地を敷かない(null)。遷移色が刻々変わるため、
 *                                     generating ページ自身が fixed の地を遷移色に同期して敷く。
 *
 * `fixed inset-0` は max-w-[402px] のコンテンツ幅や min-h-dvh のフロー高に
 * 依存せず、モバイル/PC どちらでも必ず全面の地を作る。
 * 色は globals.css のセマンティックトークン経由(直 hex 禁止)。
 *
 * BackgroundLayer(浮世絵 + veil)はこの上(z-0/z-1)に重なり、PC ではその絵柄が地を覆う。
 * モバイルでは BackgroundLayer 非表示でも、この地が黒露出を防ぐ。
 */

function bgClassFor(pathname: string): string | null {
  // /generating は遷移色が刻々変わるため、ページ自身が fixed の地を同期して敷く。
  // 二重の -z-10 が競合して暗い地が前面に出るのを避けるため、ここでは描かない。
  if (pathname.startsWith("/generating")) return null;
  if (pathname === "/folklore") return "bg-offwhite-0";
  // 夜ルート・既定はすべて墨。
  return "bg-sumi-0";
}

export default function RootBackground() {
  const pathname = usePathname();
  const bg = bgClassFor(pathname);
  if (!bg) return null;
  return (
    <div
      aria-hidden="true"
      className={"pointer-events-none fixed inset-0 -z-10 " + bg}
    />
  );
}
