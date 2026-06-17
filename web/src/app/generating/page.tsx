"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GenerateError, { type GenerateErrorKind } from "@/components/GenerateError";
import {
  loadTags,
  loadStory,
  saveStory,
  saveFolklore,
  addHistory,
  attachFolkloreToHistory,
  loadHistory,
} from "@/lib/yotogiStorage";
import { maybeCorruptStory } from "@/lib/corruption";

/**
 * Generating (`/generating`) — 二相の待機演出 + 失敗フィードバック
 *
 * クエリ `?next=story` or `?next=folklore` で遷移先と演出を切替。
 *
 *   - `?next=story`（タグ→怪談）: 「夜の簡易ローダー」。dawn の夜明けは使わない。
 *      暗い夕闇のトーンのまま、漢字「怪」が静かに息づく控えめな待機。
 *      「夜に入っていく」雰囲気。明るくしない・夜明けにしない。
 *   - `?next=folklore`（解説を作成）: dawn 演出（暗→薄→明→解、4フレーム計8秒）。
 *      ここが夜明け＝解説（昼）への移行。dawn-1 → dawn-4 を 2000ms ずつ自動進行。
 *
 * 生成結果の判定（両パス共通）:
 *   - レスポンスヘッダ `x-yotogi-source` が `fallback-` で始まる → 失敗（固定文を握り潰さない）
 *   - fetch 自体が失敗（ネットワーク不通・timeout/abort）→ 失敗
 *   - tags / story が欠落 → empty（/motif へ誘導）
 *   - 成功 → 怪談/解説を保存し、履歴に積んで next へ遷移
 *
 * 設計判断（演出中の失敗）: 失敗が演出途中で判明しても演出は中断せず、
 * 最小表示（dawn なら「解」まで／夜ローダーなら一定時間）を見せ切ってから
 * エラー画面に切り替える。儀式を壊さず世界観に馴染ませる。
 *
 * - AbortController で fetch を中断 (画面離脱・タイムアウト時)
 * - prefers-reduced-motion 尊重 / Esc キーで前画面に戻れる (a11y 脱出)
 */

type DawnFrame = {
  id: string;
  bg: string;
  text: string;
  kanji: string;
  progress: number; // 0-100
};

// 解説(folklore)への夜明け: 暗→薄→明→解（夜→昼）。
const DAWN_FRAMES: DawnFrame[] = [
  { id: "dawn-1", bg: "#181614", text: "#C8C4BE", kanji: "暗", progress: 15 },
  { id: "dawn-2", bg: "#3A3530", text: "#C2BDB6", kanji: "薄", progress: 40 },
  { id: "dawn-3", bg: "#ACA49A", text: "#1A1614", kanji: "明", progress: 70 },
  { id: "dawn-4", bg: "#CBC5BC", text: "#1A1614", kanji: "解", progress: 95 },
];

// 怪談(story)への日暮れ: 明→薄→暗→怪（明→暗）。解説の dawn「暗→薄→明」の逆順。
const DUSK_FRAMES: DawnFrame[] = [
  { id: "dusk-1", bg: "#CBC5BC", text: "#1A1614", kanji: "明", progress: 15 },
  { id: "dusk-2", bg: "#ACA49A", text: "#1A1614", kanji: "薄", progress: 40 },
  { id: "dusk-3", bg: "#3A3530", text: "#C2BDB6", kanji: "暗", progress: 70 },
  { id: "dusk-4", bg: "#181614", text: "#C8C4BE", kanji: "怪", progress: 95 },
];

const FRAME_DURATION_MS = 2000;
const TRANSITION_MS_DEFAULT = 1600;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
// 生成 API の最大待機時間。解説(folklore)は draft+verifier の Sonnet 2 段で
// 実測 22〜35s かかる（story 単段でも 13〜14s）。15s では解説がほぼ毎回 abort され
// 「解説が生成されない」状態になっていたため、実測に余裕を持たせて 60s とする。
const API_MAX_WAIT_MS = 60000;

// API 呼び出しの結末。dawn 完了後にこれを見てエラー or 遷移を決める。
type Outcome =
  | { kind: "pending" }
  | { kind: "ok" }
  | { kind: "empty" } // tags / story 欠落
  | { kind: "error"; reason: GenerateErrorKind };

function classifyFallbackSource(src: string): GenerateErrorKind {
  if (src === "fallback-no-key") return "no-key";
  // fallback-error / fallback-gate-* / その他はまとめて生成失敗扱い
  return "error";
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  return reduced;
}

function DawnSequence() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const reducedMotion = usePrefersReducedMotion();
  const transitionMs = reducedMotion ? 0 : TRANSITION_MS_DEFAULT;

  const phase: "story" | "folklore" =
    nextParam === "folklore" ? "folklore" : "story";
  const next = phase === "folklore" ? "/folklore" : "/story";
  // folklore=夜明け(夜→昼) / story=日暮れ(昼→夜)。演出を解説と反転させる。
  const FRAMES = phase === "folklore" ? DAWN_FRAMES : DUSK_FRAMES;

  const [index, setIndex] = useState(0);
  const [apiDone, setApiDone] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "pending" });
  // 演出を最小時間見せ切ったか。エラーは演出完了後にのみ提示する。
  // folklore=dawn-4（解）到達、story=夜ローダーの最小表示時間経過。
  const [introComplete, setIntroComplete] = useState(false);
  const mountedRef = useRef(true);

  // dawn 演出と並列で API 呼び出しを走らせる。
  //
  // React StrictMode（dev）では effect が mount→unmount→remount で 2 回走る。
  // cleanup で controller.abort() すると最初の fetch が中断されるため、
  // 「画面離脱由来の abort（=cleanup）」と「timeout 由来の abort」を区別する必要がある。
  //   - cancelled: この effect インスタンスの cleanup が走ったか（= 離脱）。
  //   - timedOut : API_MAX_WAIT_MS 経過で能動的に abort したか（= 本物のタイムアウト）。
  // abort が cancelled 由来なら何も報告しない（StrictMode 再マウントで再実行される）。
  // apiStarted は撤廃: 再マウント時に再 fetch させる。fallback/履歴は冪等
  // （addHistory は直近重複を弾く）なので二重実行は安全。
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, API_MAX_WAIT_MS);

    const finish = (o: Outcome) => {
      if (!cancelled) {
        setOutcome(o);
        setApiDone(true);
      }
    };

    const run = async () => {
      try {
        const tags = loadTags();
        if (!tags) {
          finish({ kind: "empty" });
          return;
        }

        if (phase === "folklore") {
          const story = loadStory();
          if (!story) {
            finish({ kind: "empty" });
            return;
          }
          const res = await fetch("/api/generate-folklore", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              tags,
              title: story.title,
              body: story.body,
            }),
            signal: controller.signal,
          });
          const src = res.headers.get("x-yotogi-source") ?? "";
          if (!res.ok) {
            finish({ kind: "error", reason: "error" });
            return;
          }
          if (src.startsWith("fallback")) {
            finish({ kind: "error", reason: classifyFallbackSource(src) });
            return;
          }
          const f = await res.json();
          if (!cancelled) {
            saveFolklore(f);
            // 履歴の直近エントリ（=この怪談）に解説を後付けする
            const list = loadHistory();
            const head = list[0];
            if (head && head.title === story.title && head.body === story.body) {
              attachFolkloreToHistory(head.id, f);
            }
          }
          finish({ kind: "ok" });
        } else {
          const res = await fetch("/api/generate-story", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tags }),
            signal: controller.signal,
          });
          const src = res.headers.get("x-yotogi-source") ?? "";
          if (!res.ok) {
            finish({ kind: "error", reason: "error" });
            return;
          }
          if (src.startsWith("fallback")) {
            finish({ kind: "error", reason: classifyFallbackSource(src) });
            return;
          }
          const s = await res.json();
          if (!cancelled) {
            // ネットロアの呪い: 約 1/10 で怪談が文字化け/無意味な羅列になる。
            const story = maybeCorruptStory(s);
            saveStory(story);
            addHistory({ tags, title: story.title, body: story.body });
          }
          finish({ kind: "ok" });
        }
      } catch {
        // fetch が投げるのは abort（timeout / 画面離脱）か通信不通。
        //   - cancelled（cleanup 由来の abort）→ 何も報告しない。
        //     StrictMode の再マウントで run() が再実行されるのを待つ。
        //   - timeout / 通信不通 → network エラー（Figma 134:56 / 霧）。
        if (!cancelled) {
          finish({ kind: "error", reason: "network" });
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    };
    run();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [phase]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 演出の進行。
  //   - story:    夜ローダーを最小時間だけ見せ、introComplete を立てる（フレーム遷移なし）。
  //   - folklore: dawn-1 → dawn-4 を自動進行し、最終フレーム（解）到達で introComplete。
  useEffect(() => {
    if (index < FRAMES.length - 1) {
      const t = window.setTimeout(() => {
        if (mountedRef.current) setIndex((i) => i + 1);
      }, FRAME_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    // 最終フレームを一定時間見せたら演出完了とみなす
    const t = window.setTimeout(() => {
      if (mountedRef.current) setIntroComplete(true);
    }, FRAME_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [index, FRAMES.length]);

  // 演出完了 & API 完了の両方が揃ったら、結果に応じて遷移 or エラー提示。
  useEffect(() => {
    if (!introComplete) return;
    if (!apiDone) {
      // 演出は終わったが API がまだ。timeout(15s) までは待機画面のまま待つ。
      return;
    }
    if (outcome.kind === "ok") {
      router.replace(next);
    }
    // empty / error は描画側で GenerateError（空状態 / 失敗）を出す（遷移しない）
  }, [introComplete, apiDone, outcome, next, router]);

  // Esc キーで脱出 (a11y)。
  const handleSkip = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 2) {
      router.back();
    } else {
      router.replace("/motif");
    }
  }, [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSkip]);

  // 再試行: 同じ phase で生成し直す（履歴・遷移ロジックを再走させる）
  const handleRetry = useCallback(() => {
    router.replace(`/generating?next=${phase}&r=${Date.now()}`);
  }, [router, phase]);

  // ── 空状態（モチーフ未選択）──
  // tags が無ければ生成のしようがない。dawn 演出を待たず即座に
  // EmptyState-NoMotif (Figma 134:57) を提示し、モチーフ選択へ誘導する。
  if (outcome.kind === "empty") {
    return (
      <GenerateError
        phase={phase}
        kind="empty"
        onRetry={() => router.replace("/motif")}
        onBackToMotif={() => router.replace("/motif")}
      />
    );
  }

  // ── エラー表示（演出完了後にのみ） ──
  // 設計判断: 失敗が演出途中で判明しても儀式は中断せず、最小表示を
  // 見せ切ってから ErrorState (134:55/56) に切り替える。
  if (introComplete && apiDone && outcome.kind === "error") {
    return (
      <GenerateError
        phase={phase}
        kind={outcome.reason}
        onRetry={handleRetry}
        onBackToMotif={() => router.replace("/motif")}
      />
    );
  }

  // ── フレーム演出 ── folklore=夜明け(夜→昼) / story=日暮れ(昼→夜)。
  const frame = FRAMES[index];

  return (
    <main
      className="relative flex min-h-dvh w-full flex-col items-center justify-center"
      style={{
        backgroundColor: frame.bg,
        color: frame.text,
        transitionProperty: "background-color, color",
        transitionDuration: `${transitionMs}ms`,
        transitionTimingFunction: EASING,
      }}
      aria-label={phase === "folklore" ? "解説を生成中" : "怪談を生成中"}
    >
      {/* スキップ (Esc) — a11y 脱出。 */}
      <button
        type="button"
        onClick={handleSkip}
        aria-label="生成を中止して戻る"
        className="absolute right-4 top-4 rounded-full px-3 py-1 text-[12px] opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ color: frame.text, borderColor: frame.text }}
      >
        スキップ
      </button>

      {/* 漢字一字 — 画面中央。 */}
      <span
        aria-hidden="true"
        className="font-mincho font-medium text-[48px] leading-none"
        style={{
          color: frame.text,
          transitionProperty: "color",
          transitionDuration: `${transitionMs}ms`,
          transitionTimingFunction: EASING,
        }}
      >
        {frame.kanji}
      </span>

      {/* sr-only ステータス。 */}
      <span className="sr-only" aria-live="polite">
        {`生成進捗 ${frame.progress}%`}
      </span>

      {/* 極細プログレ — 1px × 200px, 中央寄せ */}
      <div
        className="mt-10 h-px w-[200px] overflow-hidden"
        style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
        role="progressbar"
        aria-label="生成進捗"
        aria-valuenow={frame.progress}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className="h-full"
          style={{
            width: `${frame.progress}%`,
            backgroundColor: frame.text,
            transitionProperty: "width, background-color",
            transitionDuration: `${transitionMs}ms`,
            transitionTimingFunction: EASING,
          }}
        />
      </div>
    </main>
  );
}

export default function GeneratingPage() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-dvh w-full items-center justify-center"
          style={{ backgroundColor: DAWN_FRAMES[0].bg, color: DAWN_FRAMES[0].text }}
        />
      }
    >
      <DawnSequence />
    </Suspense>
  );
}
