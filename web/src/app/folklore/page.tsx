"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBar from "@/components/StatusBar";
import ChevronLeftIcon from "@/components/ChevronLeftIcon";
import PCFrame from "@/components/PCFrame";
import FolkloreGlosses from "@/components/FolkloreGlosses";
import {
  loadFolklore,
  loadStory,
  type StoredFolklore,
} from "@/lib/yotogiStorage";

/**
 * FolkloreAnalysis `/folklore` — Figma 46:581 explanation-screen-day 完全準拠
 *
 * 構造: scrolling-body 内に night-fragment（墨色カード）+ transition（線+sun icon）+
 *       academic-section（「民俗学的解説」見出し + 3 リスト項目）。
 *
 * 配色: bg offwhite-0 #F5F2EA、本文 sumi-1 #1C1814、見出し benigara #7A3B2E、
 *       night-fragment は bg sumi-1 + text offwhite-1。
 *
 * /api/generate-folklore の結果と /story のタイトル・本文を localStorage で復元。
 * SSR では fallback を描画する。
 */

const FALLBACK_TITLE = "井戸を覗くな";
const FALLBACK_EXCERPT =
  "その井戸は、村のいちばん奥にあった。誰も水を汲まないのに、夜になると底から、子どもの声がした。 「覗いてはいけない」と祖母は言った。覗いた者は、次の夏には居なくなる。";
const FALLBACK_FOLKLORE: StoredFolklore = {
  denshou_no_kata:
    "井戸の底に女霊・子の霊が宿るという話形は、東日本「井戸女」、西日本「井戸の子守」として広く採録される。柳田國男『遠野物語』第六十話、池田弥三郎『日本人と死者』に近い類例がある。",
  butai_no_imi:
    "井戸は古来「他界との通路」とされ、水鏡に他者の姿が映る場として忌憚された。水源を清浄に保つための戒律と異界接触への恐れが折り重なっている。",
  eranda_motif:
    "「水辺・井戸・海」「女の霊・悪霊」「あと1つ」。これらは戦前の民俗誌に頻出する組み合わせで、水神信仰の負の側面を構成している。",
};

export default function FolkloreAnalysisPage() {
  const [title, setTitle] = useState<string>(FALLBACK_TITLE);
  const [excerpt, setExcerpt] = useState<string>(FALLBACK_EXCERPT);
  const [folklore, setFolklore] = useState<StoredFolklore>(FALLBACK_FOLKLORE);

  useEffect(() => {
    // SSR で fallback を描画して hydration mismatch を避けるため、
    // localStorage 読み込みは意図的に effect 内で行う
    const s = loadStory();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (s?.title) setTitle(s.title);
    if (s?.body) {
      // night-fragment は collapsed-body として先頭付近のみ表示する。
      // 本文先頭から 2 段落程度を 1 行に圧縮して見せる
      const cleaned = s.body.split(/\n\n+/).slice(0, 2).join(" ");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setExcerpt(cleaned);
    }
    const f = loadFolklore();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (f) setFolklore(f);
  }, []);

  const sections: { label: string; body: string }[] = [
    { label: "【伝承の型】", body: folklore.denshou_no_kata },
    { label: "【舞台の意味】", body: folklore.butai_no_imi },
    { label: "【あなたが選んだモチーフ】", body: folklore.eranda_motif },
  ];

  return (
    <PCFrame mode="day" bgImage="/images/scholar-desk.jpg">
      <FolkloreGlosses />
      {/* tablet (768/1024) でも max-w-[402px] でモバイル列を維持。
          min-h-screen で内容が長い場合スクロール、短い場合は viewport いっぱい */}
      <div className="bg-offwhite-0 lg:bg-offwhite-0/85 text-sumi-1 mx-auto flex min-h-screen w-full max-w-[402px] flex-col">
        {/* StatusBar — Figma 46:583: 9:41 を sumi-1 で表示。PC では非表示 */}
        <StatusBar className="text-sumi-1 lg:hidden" />

        {/* Header Type (46:589) — h-44, "解説" 中央、戻る chevron 左端 */}
        <nav className="relative flex h-11 items-center">
          <Link
            href="/story"
            aria-label="戻る"
            className="absolute left-4 flex h-6 w-6 items-center justify-center text-sumi-1 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
          >
            <ChevronLeftIcon />
          </Link>
          <p className="w-full text-center font-sans text-[16px] leading-[1.7] text-sumi-1">
            解説
          </p>
        </nav>

        {/* scrolling-body (46:599) — p-24 gap-24 */}
        <main className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
          {/* night-fragment (46:600) — bg sumi-1 rounded-20 p-24 gap-16 */}
          <section className="flex flex-col gap-4 overflow-clip rounded-[20px] bg-sumi-1 p-6">
            {/* label-row — red "怖い話" pill */}
            <div className="flex items-center">
              <div className="rounded-[4px] bg-red-accent px-2 py-[2px]">
                <p className="font-sans text-[16px] font-bold leading-[1.4] text-offwhite-1">
                  怖い話
                </p>
              </div>
            </div>

            {/* header-row — Mincho SemiBold 22 title + chevron-down */}
            <div className="flex items-center justify-between">
              <p className="font-mincho text-[22px] font-semibold leading-[1.5] text-offwhite-1">
                {title}
              </p>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                className="text-offwhite-1"
                aria-hidden="true"
              >
                <path
                  d="M6 9l6 6 6-6"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* collapsed-body — body excerpt with fade-overlay。
                opacity でコントラスト不足になるので text-offwhite-2 直指定 (AA 5.8:1) */}
            <div className="relative">
              <p className="font-sans text-[14px] font-normal leading-[1.7] text-offwhite-2">
                {excerpt}
              </p>
              {/* fade-overlay — bottom 60px gradient to #1A1A1A */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute bottom-0 left-0 right-0 h-[60px]"
                style={{
                  background:
                    "linear-gradient(to bottom, rgba(28,24,20,0) 0%, #1c1814 100%)",
                }}
              />
            </div>
          </section>

          {/* transition (46:611) — line | sun icon | line, py-12 gap-12 */}
          <div className="flex items-center gap-3 py-3">
            <div className="h-px flex-1 bg-sand-rule" aria-hidden="true" />
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,210,158,1) 0%, rgba(255,181,109,0) 70%)",
              }}
              aria-hidden="true"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <circle cx="10" cy="10" r="3.5" fill="#7A3B2E" />
                {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                  <line
                    key={deg}
                    x1="10"
                    y1="2.5"
                    x2="10"
                    y2="5"
                    stroke="#7A3B2E"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    transform={`rotate(${deg} 10 10)`}
                  />
                ))}
              </svg>
            </div>
            <div className="h-px flex-1 bg-sand-rule" aria-hidden="true" />
          </div>

          {/* academic-section (46:617) — section-header + 3 list items */}
          <section className="flex flex-col gap-4">
            {/* section-header (46:618) — "民俗学的解説" Mincho 16 benigara + 40px hairline */}
            <div className="flex items-center gap-2">
              <p className="font-mincho text-[16px] leading-[1.9] text-benigara">
                民俗学的解説
              </p>
              <div className="h-px w-10 bg-benigara opacity-30" aria-hidden="true" />
            </div>

            {/* explanation-list (46:621) — 3 items, each: title (Mincho benigara) + body (Noto Sans sumi-1), border-b sumi-0 */}
            <div className="flex flex-col">
              {sections.map((sec, i) => (
                <div
                  key={sec.label}
                  className={`flex min-h-[72px] flex-col gap-2 bg-offwhite-0 px-4 py-2 ${
                    i < sections.length - 1 ? "border-b border-sumi-0" : ""
                  }`}
                >
                  <p className="font-mincho text-[16px] leading-[1.9] text-benigara">
                    {sec.label}
                  </p>
                  <p className="font-sans text-[14px] font-normal leading-[1.7] text-sumi-1">
                    {sec.body}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </main>
      </div>
    </PCFrame>
  );
}
