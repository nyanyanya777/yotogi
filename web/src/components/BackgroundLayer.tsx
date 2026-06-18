"use client";

import { usePathname } from "next/navigation";

/**
 * BackgroundLayer — PC(≥440px)のフルブリード浮世絵「周囲(surround)」を全ルート統一で敷く層。
 *
 * 以前は各ページの PCFrame が個別に `position: fixed` の <img> を描いていたため、
 * ルート遷移のたびに <img> が unmount→mount され点滅していた。この層を
 * RootLayout に常駐させると <img> の DOM ノードがナビゲーション間で保持され、
 * React は src が変わるときだけ差し替える。同一画像の遷移では何も起きない。
 *
 * 額装モデル(統一ルール):
 *   [フルブリード浮世絵 surround を強く減光＋ブラー＋放射ビネットで継ぎ目を消す]
 *   + [中央 402px の額装コラム(枠＋影は PCFrame)]
 *   + [コラム自身の地色はページのテーマ(夜=墨 / 昼=和紙)]
 *
 * すべてのルート(/ , /motif , /story , /folklore , /generating)で周囲を出す。
 * /folklore も周囲は他と同じ暗い浮世絵にし、和紙(クリーム)はコラム内だけに閉じる。
 * 画像は強く処理(object-cover 全面 + blur + 暗幕＋放射ビネット)するので、
 * どの画像の継ぎ目/トリミング線も知覚されず中央列が際立つ。
 *
 * モバイル(<440px)では周囲が無いため非表示(min-[440px]:block)。地は RootBackground が担う。
 */

// ルート別の周囲画像。全ルートで必ず 1 枚出す(/generating も含む)。
function surroundSrc(pathname: string): string {
  if (pathname === "/story") return "/images/pc-story-bg.jpg";
  if (pathname === "/folklore") return "/images/pc-folklore-bg.jpg";
  // / , /motif , /generating , その他既定 → ろくろ首(夜の場面)
  return "/images/pc-rokurokubi-bg.jpg";
}

export default function BackgroundLayer() {
  const pathname = usePathname();
  const src = surroundSrc(pathname);

  return (
    <>
      {/* 浮世絵 — 全面 object-cover + 強ブラー。scale で blur のにじみ縁を画面外へ逃がす。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full scale-110 object-cover blur-[14px] min-[440px]:block"
      />
      {/* 暗幕＋放射ビネット — 継ぎ目を消し中央列を引き立てる(globals: yotogi-surround-veil)。 */}
      <div
        aria-hidden="true"
        className="yotogi-surround-veil pointer-events-none fixed inset-0 z-[1] hidden min-[440px]:block"
      />
    </>
  );
}
