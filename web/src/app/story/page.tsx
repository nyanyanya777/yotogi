"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import StatusBar from "@/components/StatusBar";
import IconButton from "@/components/IconButton";
import PrimaryCTA from "@/components/PrimaryCTA";
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
import { decodeStory } from "@/lib/shareLink";

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
  const sharedToken = searchParams.get("s");
  const [story, setStory] = useState<StoredStory>(FALLBACK_STORY);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  useEffect(() => {
    // SSR で fallback を出して hydration mismatch を避けるため、
    // localStorage 読み込みは意図的に effect 内で行う

    // 共有リンク: ?s=<token> は本文を内包した怪談。デコードして current に復元し表示。
    if (sharedToken) {
      const decoded = decodeStory(sharedToken);
      if (decoded) {
        const restored = { title: decoded.title, body: decoded.body };
        saveStory(restored);
        if (decoded.tags.length === 3) saveTags(decoded.tags);
        clearFolklore();
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setStory(restored);
        return;
      }
      // 壊れたトークンは無視して通常フローへ
    }

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
  }, [historyId, sharedToken, router]);

  // 共有: 怪談本文をサーバ（Vercel Blob）に保存し、短い共有URL `/s/<id>` を払い出す。
  // 受け手はその URL を開くと本文が復元・表示される（src/app/s/[id]/page.tsx）。
  // 共有テキストは「タイトル + さわり」を Web Share、非対応ならクリップボードへ。
  // 保存に失敗したらアプリトップ URL だけでフォールバック共有する。
  const handleShare = async () => {
    if (typeof window === "undefined") return;
    // 既定はアプリトップ（保存失敗時のフォールバック）。
    let url = window.location.origin;
    try {
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: story.title,
          body: story.body,
          tags: loadTags() ?? [],
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { id?: unknown };
        if (typeof data.id === "string" && data.id.length > 0) {
          // 固定クエリ `?s=1` を付与して共有する。OG 対応前に「クエリ無しの素 URL」を
          // 貼った SNS（X / LINE 等）が「カード無し」状態をキャッシュし続けるため、
          // 別のキャッシュキー（?s=1）にして初見扱いさせ、その場で新カードを取りに行かせる。
          // 値は固定なので再シェアでも同一 URL（安定）。generateMetadata / opengraph-image は
          // params のみ参照しクエリを無視するため、カード内容は変わらない。
          url = `${window.location.origin}/s/${data.id}?s=1`;
        }
      }
    } catch {
      // ネットワーク等で失敗 → フォールバック URL（アプリトップ）のまま共有を続ける。
    }
    // 本文の冒頭を 1 行に均し、約 70 字で抜粋（超過時は末尾 … で省略）。
    const flat = story.body.replace(/\s+/g, " ").trim();
    const excerpt = flat.length > 70 ? `${flat.slice(0, 70)}…` : flat;
    const text = `『${story.title}』\n${excerpt}`;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: story.title, text, url });
        return;
      } catch (e) {
        // ユーザーがシートをキャンセルした場合(AbortError)はコピーしない
        if (e instanceof Error && e.name === "AbortError") return;
        // それ以外の失敗はクリップボードにフォールバック
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setShareMsg("リンクをコピーしました");
    } catch {
      setShareMsg("コピーできませんでした");
    }
    window.setTimeout(() => setShareMsg(null), 2000);
  };

  // 段落分割（モデル出力は \n\n 区切りを想定）。
  const paragraphs = story.body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);

  return (
    <PCFrame mode="night" frameShadow="night">
      {/* min-h-dvh + sticky footer。content は自然スクロール、
          landscape でも横画面で読める。pb-[160px] で最終段落が隠れない */}
      <div className="bg-sumi-0 text-offwhite-2 mx-auto min-h-dvh w-full max-w-[402px] flex flex-col min-[440px]:min-h-full">
      <StatusBar className="text-offwhite-2" />

      {/* NavBar — chevron は履歴を 1 段戻す。直接エントリ時は /motif に fallback */}
      <nav className="flex h-12 items-center px-4">
        <button
          type="button"
          onClick={() => router.push(historyId ? "/" : "/motif")}
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
      <footer
        className="sticky bottom-0 bg-sumi-0 px-6 pt-4 backdrop-blur-sm"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        {/* SubActions — 共有 + 再生成。再生成は localStorage クリアして dawn に戻す */}
        <div className="flex items-center justify-end gap-4 mb-4 text-sumi-3">
          <IconButton
            label="共有"
            onClick={handleShare}
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

        {/* 統一 CTA（secondary）: bg offwhite-2 / text sumi-1。寸法は全 CTA 共通
            (h48 / rounded-full / w-full / Noto Sans Bold 16) */}
        <PrimaryCTA href="/generating?next=folklore" label="解説を作成" variant="secondary" />
      </footer>

      {shareMsg && (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-6"
        >
          <span className="rounded-full bg-offwhite-1 px-4 py-2 font-sans text-[13px] leading-none text-sumi-1 shadow-[0_4px_16px_rgba(0,0,0,0.4)]">
            {shareMsg}
          </span>
        </div>
      )}
      </div>
    </PCFrame>
  );
}

export default function StoryReadingPage() {
  // useSearchParams は Suspense 境界を要求する（Next.js App Router）
  return (
    <Suspense
      fallback={
        <PCFrame mode="night" frameShadow="night">
          <div className="bg-sumi-0 mx-auto min-h-dvh w-full max-w-[402px] min-[440px]:min-h-full" />
        </PCFrame>
      }
    >
      <StoryReading />
    </Suspense>
  );
}
