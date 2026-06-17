"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { loadHistory, type HistoryEntry } from "@/lib/yotogiStorage";

/**
 * HistoryAccordion — スプラッシュ右上の「履歴」アコーディオン（夜の相）。
 *
 * 既定は閉じたチップ 1 個だけ。開くと過去の怪談を新しい順にパネルで提示し、
 * 各行タップで `/story?h=<id>` へ。履歴が無い間は何も出さない（初回画面を汚さない）。
 * 以前はスプラッシュ下部の HistoryStrip だったが、右上アコーディオンに置き換えた。
 *
 * localStorage 依存なので SSR では空。useEffect でクライアント側のみ充填し
 * hydration mismatch を避ける。
 */
export default function HistoryAccordion() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEntries(loadHistory().slice(0, 8));
  }, []);

  if (entries.length === 0) return null;

  return (
    <div className="absolute right-3 top-12 z-30 flex flex-col items-end">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="history-panel"
        className="flex items-center gap-1.5 rounded-full border border-offwhite-1/30 bg-sumi-1/70 px-3 py-1.5 font-sans text-[13px] leading-none text-offwhite-1 backdrop-blur-sm transition-colors hover:border-offwhite-1/60 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
      >
        履歴
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          id="history-panel"
          className="mt-2 max-h-[60vh] w-[260px] overflow-y-auto rounded-[12px] border border-offwhite-1/15 bg-sumi-1/95 p-2 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-sm"
        >
          <p className="px-2 pb-1 pt-1 font-mincho text-[12px] leading-[1.6] text-sumi-3">
            これまでの怪談
          </p>
          <ul className="flex flex-col">
            {entries.map((e, i) => (
              <li key={e.id}>
                <Link
                  href={`/story?h=${encodeURIComponent(e.id)}`}
                  onClick={() => setOpen(false)}
                  className={`flex flex-col gap-0.5 rounded-[6px] px-2 py-2 transition-colors hover:bg-offwhite-1/5 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent ${
                    i < entries.length - 1 ? "border-b border-offwhite-1/10" : ""
                  }`}
                >
                  <span className="truncate font-mincho text-[14px] leading-[1.5] text-offwhite-1">
                    {e.title}
                  </span>
                  <span className="font-sans text-[11px] leading-none text-sumi-3">
                    {formatDate(e.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
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
