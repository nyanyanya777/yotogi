"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import StatusBar from "@/components/StatusBar";
import Chip from "@/components/Chip";
import PrimaryCTA from "@/components/PrimaryCTA";
import PCFrame from "@/components/PCFrame";
import { saveTags, clearStory, clearFolklore } from "@/lib/yotogiStorage";
import { maybeCorruptTagMap } from "@/lib/corruption";

/**
 * MotifSelection (Screen#MotifSelection, Figma 15:1011)
 * 舞台/存在/属性 を1画面で選択する。
 * - チップは toggle、カテゴリ跨ぎで合計3つ選ぶ
 * - 3つ揃ったら CTA active
 * 仕様: §3.2 / Figma 最新版 16語彙（舞台6・存在5・属性5）
 */

const CATEGORIES = [
  {
    label: "舞台",
    chips: [
      "学校・施設",
      "水辺・井戸・海",
      "山・峠・トンネル",
      "村・密み地",
      "ネット・電子空間",
      "病院・架橋空間",
    ],
  },
  {
    label: "存在",
    chips: [
      "女の霊・悪霊",
      "子ども・赤子の霊",
      "異形・正体不明",
      "人形・像",
      "人間（生身の怖さ）",
    ],
  },
  {
    label: "属性",
    chips: [
      "呪い・祟り",
      "錯乱（見えなくなる）",
      "過去・繰り代わる",
      "憑依・伏願目取",
      "神隠し・行方不明",
    ],
  },
] as const;

// 16 語彙のフラット一覧（タグ文字化けの抽選母集団）。
const ALL_LABELS: string[] = CATEGORIES.flatMap((c) => [...c.chips]);

const REQUIRED = 3;

export default function MotifSelectionPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  // ネットロアの呪い: 約 1/10 で 16 個中 1 つのタグが文字化けする。
  // SSR と差異が出るため mount 後にのみ適用（hydration mismatch 回避）。
  const [corruptMap, setCorruptMap] = useState<Record<string, string>>({});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCorruptMap(maybeCorruptTagMap(ALL_LABELS));
  }, []);

  const toggle = (label: string) => {
    setSelected((prev) => {
      if (prev.includes(label)) return prev.filter((x) => x !== label);
      // 3 つに達したら追加を拒否（loadTags が length===3 のみ復元する仕様に合わせる）
      if (prev.length >= REQUIRED) return prev;
      return [...prev, label];
    });
  };

  const count = selected.length;
  const isReady = count === REQUIRED;

  // SelectionSummary は選択順で「水辺・井戸・海 / 女の霊・悪霊 / あと1つ」
  const summaryParts = useMemo(() => {
    const parts: { text: string; muted?: boolean }[] = selected.map((s) => ({
      text: s,
    }));
    const remaining = REQUIRED - count;
    if (remaining > 0) {
      parts.push({ text: `あと${remaining}つ`, muted: true });
    }
    return parts;
  }, [selected, count]);

  return (
    <PCFrame mode="night" bgImage="/images/pc-splash-bg.jpg" frameShadow="night">
      {/* min-h-screen で portrait は普通に縦長、landscape では自然スクロール。
          BottomBar の position:sticky bottom-0 はページ自体のスクロールに対し効く */}
      <div className="relative mx-auto flex min-h-screen w-full max-w-[402px] flex-col bg-sumi-0">
        <StatusBar className="" />

        {/* NavBar — Figma 15:1019: px-20 py-16, justify-between */}
        <div className="flex items-center justify-between px-5 py-4">
          <button
            type="button"
            onClick={() => router.push("/")}
            aria-label="戻る"
            className="flex h-6 w-6 items-center justify-center text-offwhite-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M15 6 9 12l6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <p className="font-sans text-[16px] font-bold leading-[1.4] text-offwhite-1">
            モチーフを3つ選ぶ
          </p>
          <p
            className="font-sans text-[14px] font-normal leading-[1.7] text-offwhite-1"
            aria-live="polite"
            aria-label={`${count} / ${REQUIRED} 選択中`}
          >
            {count} / {REQUIRED}
          </p>
        </div>

        {/* header text — Figma 15:1024: Noto Sans Regular 14 leading 1.7, px-24 py-12 */}
        <p className="px-6 py-3 font-sans text-[14px] leading-[1.7] text-offwhite-1">
          気になるものを3つ、タップで選択・解除できます。
        </p>

        {/* ScrollContent — Figma 15:1025: p-24 gap-40. pb-[180px] で sticky CTA に
            隠れないよう底に余白を確保 */}
        <div className="flex flex-col gap-10 p-6 pb-[180px]">
          {CATEGORIES.map((cat) => (
            <section key={cat.label} className="flex flex-col gap-4">
              {/* section-header — Figma: Noto Sans Medium 16 text-section-label, pb-8 */}
              <h2 className="pb-2 font-sans text-[16px] font-medium leading-[1.4] text-section-label">
                {cat.label}
              </h2>
              {/* chip-grid — gap-12 wrap */}
              <div className="flex flex-wrap gap-3">
                {cat.chips.map((chip) => {
                  // 呪いが乗ったラベルは表示も選択値も文字化け版に差し替える。
                  const label = corruptMap[chip] ?? chip;
                  const isSelected = selected.includes(label);
                  return (
                    <Chip
                      key={chip}
                      label={label}
                      selected={isSelected}
                      disabled={isReady && !isSelected}
                      onClick={() => toggle(label)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        {/* BottomBar — Figma 15:1071: bg sumi-0, gap-12, p-16 */}
        <div className="sticky bottom-0 left-0 right-0 z-10 mx-auto flex w-full max-w-[402px] flex-col gap-3 bg-sumi-0 p-4">
          {/* SelectionSummary — Noto Sans Regular 14 leading 1.7, gap-4, divider sumi-divider */}
          <div className="flex flex-wrap items-center gap-1 font-sans text-[14px] leading-[1.7]">
            {summaryParts.length === 0 ? (
              <span className="text-red-on-dark">あと3つ</span>
            ) : (
              summaryParts.map((p, idx) => (
                <span key={`${p.text}-${idx}`} className="flex items-center gap-1">
                  {idx > 0 && (
                    <span className="text-divider" aria-hidden="true">
                      /
                    </span>
                  )}
                  <span
                    className={p.muted ? "text-red-on-dark" : "text-offwhite-1"}
                  >
                    {p.text}
                  </span>
                </span>
              ))
            )}
          </div>
          <PrimaryCTA
            label="怪談を作る"
            disabled={!isReady}
            fullWidth
            onClick={() => {
              if (!isReady) return;
              saveTags(selected);
              clearStory();
              clearFolklore();
              router.push("/generating?next=story");
            }}
          />
        </div>
      </div>
    </PCFrame>
  );
}
