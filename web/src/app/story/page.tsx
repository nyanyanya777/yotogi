"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import StatusBar from "@/components/StatusBar";
import IconButton from "@/components/IconButton";
import ShareIcon from "@/components/ShareIcon";
import RefreshIcon from "@/components/RefreshIcon";
import ChevronLeftIcon from "@/components/ChevronLeftIcon";
import PCFrame from "@/components/PCFrame";
import {
  clearFolklore,
  clearStory,
  loadStory,
  loadTags,
  getHistoryEntry,
  saveStory,
  saveTags,
  saveFolklore,
  type StoredStory,
} from "@/lib/yotogiStorage";

/**
 * StoryReading `/story`
 * 夜の画面。生成された怪談を読む。墨黒背景 × 明朝体 × オフホワイト文字。
 * Footer は sticky bottom：SubActions（Share / Refresh）+ PrimaryCTA「解説を作成」(Figma 15:1133)。
 * PC では PCFrame night mode + 浮世絵フルブリード背景。
 * 仕様: /root/YOTOGI_IMPLEMENTATION_SPEC.md §3.4 / §3.7
 *
 * 内容は /api/generate-story の結果を localStorage から復元する。
 * SSR 時点では fixed フォールバックを描画し、useEffect でクライアント側のみ差し替える
 * （hydration mismatch を起こさないため）。
 */

const FALLBACK_STORY: StoredStory = {
  title: "井戸を覗くな",
  body:
    "その井戸は、村のいちばん奥にあった。誰も水を汲まないのに、夜になると底から、子どもの声がした。\n\n" +
    "「覗いてはいけない」と祖母は言った。覗いた者は、次の夏には居なくなる。けれど私は、声の主が知りたかった。\n\n" +
    "縁に手をかけ、暗い水面を見下ろす。そこに、白い顔がひとつ。それは、私を見上げて、たしかに笑った——",
};

function StoryReading() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const historyId = searchParams.get("h");
  const [story, setStory] = useState<StoredStory>(FALLBACK_STORY);

  useEffect(() => {
    // SSR で fallback を出して hydration mismatch を避けるため、
    // localStorage 読み込みは意図的に effect 内で行う

    // 履歴からの読み返し: ?h=<id> が指定されたら、その怪談を
    // current スロット（story/tags/folklore）に復元してから表示する。
    // こうすることで「解説を作成」や共有も読み返した怪談に対して機能する。
    if (historyId) {
      const entry = getHistoryEntry(historyId);
      if (entry) {
        const restored = { title: entry.title, body: entry.body };
        saveStory(restored);
        saveTags(entry.tags);
        if (entry.folklore) saveFolklore(entry.folklore);
        else clearFolklore();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStory(restored);
        return;
      }
    }

    // 空状態ガード: tags も story も無いまま直接来た場合は /motif へ誘導
    const s = loadStory();
    if (!s && !loadTags()) {
      router.replace("/motif");
      return;
    }
    if (s) setStory(s);
  }, [historyId, router]);

  // 段落分割（モデル出力は \n\n 区切りを想定）。
  const paragraphs = story.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <PCFrame mode="night" bgImage="/images/ukiyoe-tomomori.jpg">
      {/* min-h-screen + sticky footer。content は自然スクロール、
          landscape でも横画面で読める。pb-[160px] で最終段落が隠れない */}
      <div className="bg-sumi-0 text-offwhite-2 mx-auto min-h-screen w-full max-w-[402px] flex flex-col">
      <StatusBar className="text-offwhite-2 lg:hidden" />

      {/* NavBar — chevron は履歴を 1 段戻す。直接エントリ時は /motif に fallback */}
      <nav className="flex h-12 items-center px-4">
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 2) {
              router.back();
            } else {
              router.replace("/motif");
            }
          }}
          aria-label="戻る"
          className="flex h-11 w-11 items-center justify-center rounded-full text-offwhite-2 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
        >
          <ChevronLeftIcon />
        </button>
      </nav>

      {/* ContentWrapper — pb-[160px] で最終段落が sticky footer に隠れない */}
      <main className="flex-1 px-6 pt-4 pb-[160px]">
        {/* TitleBlock — Figma SemiBold 600 (Shippori Mincho) */}
        <h1 className="font-mincho font-semibold text-[36px] leading-[1.3] text-offwhite-2">
          {story.title}
        </h1>
        <div className="border-t border-sand-rule mt-6 mb-6" />

        {/* StoryBody */}
        <div className="font-mincho text-[16px] leading-[1.9] text-offwhite-2">
          {paragraphs.map((p, i) => (
            <p key={i} className="mb-8">
              {p}
            </p>
          ))}
        </div>
      </main>

      {/* Footer — sticky bottom-0 で page スクロールに対し viewport 下端に固定 */}
      <footer className="sticky bottom-0 bg-sumi-0 px-6 pb-6 pt-4 backdrop-blur-sm">
        {/* SubActions — 共有 + 再生成。再生成は localStorage クリアして dawn に戻す */}
        <div className="flex items-center justify-end gap-4 mb-4 text-sumi-3">
          <IconButton
            label="共有"
            onClick={() => {
              if (typeof navigator !== "undefined" && navigator.share) {
                navigator
                  .share({ title: story.title, text: story.body })
                  .catch(() => {});
              }
            }}
          >
            <ShareIcon />
          </IconButton>
          <IconButton
            label="再生成"
            onClick={() => {
              clearStory();
              clearFolklore();
              router.push("/generating?next=story");
            }}
          >
            <RefreshIcon />
          </IconButton>
        </div>

        {/* PrimaryCTA — Figma 15:1090 / instance 23:23: bg offwhite-2 #F0EBE5,
            text sumi-1, w 354, h 40, rounded full, Noto Sans Bold 16 */}
        <Link
          href="/generating?next=folklore"
          className="flex h-10 w-full items-center justify-center rounded-full bg-offwhite-2 px-4 text-[16px] font-bold text-sumi-1 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-offwhite-2"
        >
          解説を作成
        </Link>
      </footer>
      </div>
    </PCFrame>
  );
}

export default function StoryReadingPage() {
  // useSearchParams は Suspense 境界を要求する（Next.js App Router）
  return (
    <Suspense
      fallback={
        <PCFrame mode="night" bgImage="/images/ukiyoe-tomomori.jpg">
          <div className="bg-sumi-0 mx-auto min-h-screen w-full max-w-[402px]" />
        </PCFrame>
      }
    >
      <StoryReading />
    </Suspense>
  );
}
