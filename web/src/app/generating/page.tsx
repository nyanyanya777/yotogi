"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StatusBar from "@/components/StatusBar";
import {
  loadTags,
  loadStory,
  saveStory,
  saveFolklore,
} from "@/lib/yotogiStorage";

/**
 * Generating (`/generating`) — dawn 演出（4フレーム）
 *
 * クエリ `?next=story` or `?next=folklore` で遷移先を切替。
 * dawn-1 → dawn-2 → dawn-3 → dawn-4 を 2000ms ずつ自動進行し、dawn-4 完了で
 * `router.replace(next)`。フレーム間の bg / text 色は 1600ms `cubic-bezier(0.4,0,0.2,1)` で
 * CSS transition。漢字は中央 48px Shippori Mincho Medium。プログレは 1px × 200px。
 *
 * - AbortController で fetch を中断 (画面離脱・タイムアウト時)
 * - prefers-reduced-motion 尊重
 * - Esc キーで前画面に戻れる (a11y 脱出)
 *
 * 仕様: /root/YOTOGI_IMPLEMENTATION_SPEC.md §3.3
 */

type DawnFrame = {
  id: "dawn-1" | "dawn-2" | "dawn-3" | "dawn-4";
  bg: string;
  text: string;
  kanji: string;
  progress: number; // 0-100
};

const FRAMES: DawnFrame[] = [
  { id: "dawn-1", bg: "#181614", text: "#C8C4BE", kanji: "暗", progress: 15 },
  { id: "dawn-2", bg: "#3A3530", text: "#C2BDB6", kanji: "薄", progress: 40 },
  { id: "dawn-3", bg: "#ACA49A", text: "#1A1614", kanji: "明", progress: 70 },
  { id: "dawn-4", bg: "#CBC5BC", text: "#1A1614", kanji: "解", progress: 95 },
];

const FRAME_DURATION_MS = 2000;
const TRANSITION_MS_DEFAULT = 1600;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";
const API_MAX_WAIT_MS = 8000;

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

  // 既定遷移先: story
  const next: string =
    nextParam === "folklore"
      ? "/folklore"
      : nextParam === "story"
        ? "/story"
        : "/story";

  const [index, setIndex] = useState(0);
  const [apiDone, setApiDone] = useState(false);
  const apiStarted = useRef(false);
  const mountedRef = useRef(true);

  // dawn 演出と並列で API 呼び出しを走らせる。
  // AbortController で画面離脱・タイムアウト時に確実に中断する。
  useEffect(() => {
    if (apiStarted.current) return;
    apiStarted.current = true;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      API_MAX_WAIT_MS,
    );

    const safeSet = (setter: () => void) => {
      if (mountedRef.current && !controller.signal.aborted) setter();
    };

    const run = async () => {
      try {
        const tags = loadTags();
        if (!tags) {
          safeSet(() => setApiDone(true));
          return;
        }
        if (nextParam === "folklore") {
          const story = loadStory();
          if (!story) {
            safeSet(() => setApiDone(true));
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
          if (res.ok && !controller.signal.aborted) {
            const f = await res.json();
            if (mountedRef.current && !controller.signal.aborted) {
              saveFolklore(f);
            }
          }
        } else {
          const res = await fetch("/api/generate-story", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ tags }),
            signal: controller.signal,
          });
          if (res.ok && !controller.signal.aborted) {
            const s = await res.json();
            if (mountedRef.current && !controller.signal.aborted) {
              saveStory(s);
            }
          }
        }
      } catch {
        // abort 含むネットワークエラーはフロントの fallback 表示に委ねる
      } finally {
        safeSet(() => setApiDone(true));
      }
    };
    run();

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [nextParam]);

  // アンマウント検出用 — clean cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // フレーム自動進行
  useEffect(() => {
    if (index < FRAMES.length - 1) {
      const t = window.setTimeout(() => {
        if (mountedRef.current) setIndex((i) => i + 1);
      }, FRAME_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    let cancelled = false;
    const startedAt = performance.now();
    let timer: number | undefined;
    const tick = () => {
      if (cancelled || !mountedRef.current) return;
      if (apiDone || performance.now() - startedAt > API_MAX_WAIT_MS) {
        router.replace(next);
        return;
      }
      timer = window.setTimeout(tick, 250);
    };
    const initial = window.setTimeout(tick, FRAME_DURATION_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(initial);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [index, next, router, apiDone]);

  // Esc キーで脱出 (a11y)。直接エントリ (history.length <= 2) で
  // about:blank に戻らないよう /motif に replace する
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

  const frame = FRAMES[index];

  return (
    <main
      className="relative flex min-h-screen w-full flex-col items-center justify-center"
      style={{
        backgroundColor: frame.bg,
        color: frame.text,
        transitionProperty: "background-color, color",
        transitionDuration: `${transitionMs}ms`,
        transitionTimingFunction: EASING,
      }}
      aria-label="物語を生成中"
    >
      {/* StatusBar は absolute で外し、漢字の中央計算から除外する */}
      <div className="absolute top-0 left-0 right-0">
        <StatusBarTimeOnly textColor={frame.text} transitionMs={transitionMs} />
      </div>

      {/* スキップ (Esc) — a11y 脱出。SR ユーザー向けに sr-only テキストも提示 */}
      <button
        type="button"
        onClick={handleSkip}
        aria-label="生成を中止して戻る"
        className="absolute right-4 top-4 rounded-full px-3 py-1 text-[12px] opacity-60 transition-opacity hover:opacity-100 focus:opacity-100 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
        style={{ color: frame.text, borderColor: frame.text }}
      >
        スキップ
      </button>

      {/* 漢字一字 — 画面中央。aria-hidden で読まない、SR は span.sr-only から読む */}
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

      {/* sr-only ステータス。aria-live で SR に「進捗 N%」を伝える */}
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

/**
 * dawn 演出中のステータスバー — 時刻 (9:41) のみ表示。
 * フレームの text 色を currentColor に流し込んで時刻文字も同期させる。
 */
function StatusBarTimeOnly({
  textColor,
  transitionMs,
}: {
  textColor: string;
  transitionMs: number;
}) {
  return (
    <div
      className="flex h-11 w-full items-center justify-between px-6"
      style={{
        color: textColor,
        transitionProperty: "color",
        transitionDuration: `${transitionMs}ms`,
        transitionTimingFunction: EASING,
      }}
    >
      <span className="font-sans text-[15px] font-semibold tracking-tight">
        9:41
      </span>
    </div>
  );
}

export default function GeneratingPage() {
  // useSearchParams は Suspense 境界を要求する（Next.js App Router）
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen w-full items-center justify-center"
          style={{ backgroundColor: FRAMES[0].bg, color: FRAMES[0].text }}
        >
          <StatusBar className="lg:hidden" />
        </div>
      }
    >
      <DawnSequence />
    </Suspense>
  );
}
