"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadHistory, type HistoryEntry } from "@/lib/yotogiStorage";

/**
 * HistoryStrip — スプラッシュ下部に出る「読み返す」導線（夜の相）。
 *
 * 過去に紡いだ怪談を新しい順に最大 5 件、控えめなリストで提示する。
 * 各行をタップで `/story?h=<id>` へ遷移し、その怪談を読み返せる。
 * 履歴が無い間は何も描画しない（初回ユーザーの画面を汚さない）。
 *
 * localStorage 依存なので SSR では空。useEffect でクライアント側のみ充填し、
 * hydration mismatch を避ける。
 */
export default function HistoryStrip() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(loadHistory().slice(0, 5));
  }, []);

  if (entries.length === 0) return null;

  return (
    <nav aria-label="読み返す" className="mt-6 flex w-[343px] max-w-[360px] flex-col gap-2">
      <p className="font-mincho text-[13px] leading-[1.7] text-sumi-3">
        これまでの怪談
      </p>
      <ul className="flex flex-col">
        {entries.map((e, i) => (
          <li key={e.id}>
            <Link
              href={`/story?h=${encodeURIComponent(e.id)}`}
              className={`flex items-center justify-between gap-3 py-3 transition-colors hover:bg-offwhite-1/5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent ${
                i < entries.length - 1 ? "border-b border-offwhite-1/10" : ""
              }`}
            >
              <span className="truncate font-mincho text-[15px] leading-[1.5] text-offwhite-1">
                {e.title}
              </span>
              <span className="shrink-0 font-sans text-[12px] text-sumi-3">
                {formatDate(e.createdAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

function formatDate(ts: number): string {
  try {
    const d = new Date(ts);
    const m = d.getMonth() + 1;
    const day = d.getDate();
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${m}/${day} ${hh}:${mm}`;
  } catch {
    return "";
  }
}
