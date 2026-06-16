"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import StatusBar from "@/components/StatusBar";
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

/**
 * Generating (`/generating`) — dawn 演出（4フレーム）+ 失敗フィードバック
 *
 * クエリ `?next=story` or `?next=folklore` で遷移先を切替。
 * dawn-1 → dawn-2 → dawn-3 → dawn-4 を 2000ms ずつ自動進行する。
 *
 * 生成結果の判定:
 *   - レスポンスヘッダ `x-yotogi-source` が `fallback-` で始まる → 失敗（固定文を握り潰さない）
 *   - fetch 自体が失敗（ネットワーク不通・timeout/abort）→ 失敗
 *   - tags / story が欠落 → empty（/motif へ誘導）
 *   - 成功 → 怪談/解説を保存し、履歴に積んで next へ遷移
 *
 * 設計判断（dawn 中の失敗）: 失敗が dawn 途中で判明しても演出は中断せず、
 * dawn-4（解）まで見せ切ってからエラー画面に切り替える。暗→明の儀式を
 * 壊さず、「明けた先に怪が立ち上がらなかった」という世界観に馴染ませる。
 *
 * - AbortController で fetch を中断 (画面離脱・タイムアウト時)
 * - prefers-reduced-motion 尊重 / Esc キーで前画面に戻れる (a11y 脱出)
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
const API_MAX_WAIT_MS = 15000;

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

  const [index, setIndex] = useState(0);
  const [apiDone, setApiDone] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>({ kind: "pending" });
  // dawn 演出を見せ切ったか。エラーは演出完了後にのみ提示する。
  const [dawnComplete, setDawnComplete] = useState(false);
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
            saveStory(s);
            addHistory({ tags, title: s.title, body: s.body });
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

  // フレーム自動進行
  useEffect(() => {
    if (index < FRAMES.length - 1) {
      const t = window.setTimeout(() => {
        if (mountedRef.current) setIndex((i) => i + 1);
      }, FRAME_DURATION_MS);
      return () => window.clearTimeout(t);
    }
    // 最終フレーム（解）を一定時間見せたら dawn 完了とみなす
    const t = window.setTimeout(() => {
      if (mountedRef.current) setDawnComplete(true);
    }, FRAME_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [index]);

  // dawn 完了 & API 完了の両方が揃ったら、結果に応じて遷移 or エラー提示。
  useEffect(() => {
    if (!dawnComplete) return;
    if (!apiDone) {
      // dawn は終わったが API がまだ。timeout(15s) までは「解」のまま待つ。
      return;
    }
    if (outcome.kind === "ok") {
      router.replace(next);
    }
    // empty / error は描画側で GenerateError（空状態 / 失敗）を出す（遷移しない）
  }, [dawnComplete, apiDone, outcome, next, router]);

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

  // ── エラー表示（dawn 完了後にのみ） ──
  // 設計判断: 失敗が dawn 途中で判明しても暗→明の儀式は中断せず、
  // 「解」まで見せ切ってから ErrorState (134:55/56) に切り替える。
  if (dawnComplete && apiDone && outcome.kind === "error") {
    return (
      <GenerateError
        phase={phase}
        kind={outcome.reason}
        onRetry={handleRetry}
        onBackToMotif={() => router.replace("/motif")}
      />
    );
  }

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

/**
 * dawn 演出中のステータスバー — 時刻 (9:41) のみ表示。
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
