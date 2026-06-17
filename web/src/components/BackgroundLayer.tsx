"use client";

import { usePathname } from "next/navigation";

/**
 * BackgroundLayer — PC(≥440px)のフルブリード背景を「画面遷移しても据え置き」にする層。
 *
 * 以前は各ページの PCFrame が個別に `position: fixed` の <img> を描いていたため、
 * ルート遷移のたびに <img> が unmount→mount され、同じ画像でも一瞬点滅していた
 * （home→motif は同じ pc-splash でも毎回チラついた）。
 *
 * この層を RootLayout に常駐させると <img> の DOM ノードがナビゲーション間で保持され、
 * React は src が変わるときだけ差し替える。よって同一画像の遷移では何も起きず、
 * 画像が変わる遷移(story↔folklore)でのみ一度切り替わる＝チラつきが消える。
 *
 * Figma の 3 層モデル(全幅 bg + 全面 veil + 中央 402px のスマホ)のうち、
 * 下の 2 層(bg/veil)をここが担う。中央 402px 列と drop shadow は PCFrame 側。
 * veil: 夜=墨 #0B0B0B @0.6 / 昼=生成り #F5F2EA @0.45（Figma 56:48/56:73/56:110 実測）。
 *
 * モバイル(<440px)では周囲が無いため非表示(min-[440px]:block)。
 * /generating は単色の全画面演出なので背景画像は出さない。
 */

type BgConfig = { src: string; veil: string };

const NIGHT_VEIL = "bg-[rgba(11,11,11,0.6)]";
const DAY_VEIL = "bg-[rgba(245,242,234,0.45)]";

function configFor(pathname: string): BgConfig | null {
  if (pathname === "/" || pathname === "/motif") {
    // PC周囲背景はろくろ首(Takiyasha)の場面。骸骨はスマホ主役に回したため。
    return { src: "/images/pc-rokurokubi-bg.jpg", veil: NIGHT_VEIL };
  }
  if (pathname === "/story") {
    return { src: "/images/pc-story-bg.jpg", veil: NIGHT_VEIL };
  }
  if (pathname === "/folklore") {
    return { src: "/images/pc-folklore-bg.jpg", veil: DAY_VEIL };
  }
  // /generating などは背景画像なし
  return null;
}

export default function BackgroundLayer() {
  const pathname = usePathname();
  const cfg = configFor(pathname);
  if (!cfg) return null;

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cfg.src}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full scale-110 object-cover blur-[10px] min-[440px]:block"
      />
      <div
        aria-hidden="true"
        className={"pointer-events-none fixed inset-0 z-[1] hidden min-[440px]:block " + cfg.veil}
      />
    </>
  );
}
