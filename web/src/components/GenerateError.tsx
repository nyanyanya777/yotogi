"use client";

import StatusBar from "@/components/StatusBar";
import PCFrame from "@/components/PCFrame";

/**
 * GenerateError — 生成失敗 / 通信不通 / 空状態 のフィードバック画面。
 *
 * Figma の状態画面に忠実:
 *   - ErrorState-Generation-Night (134:55) … kind="error" | "no-key"
 *       祟 / 「怪談は、姿を現さなかった」 / 赤CTA「もう一度試す」 + 「モチーフを選び直す」
 *   - ErrorState-Timeout-Night   (134:56) … kind="network"
 *       霧 / 「声が、届かなかった」 / 赤CTA「再接続する」 + 「モチーフを選び直す」
 *   - EmptyState-NoMotif         (134:57) … kind="empty"
 *       空 / 「まだ、何も選ばれていません」 / 赤CTA「モチーフを選ぶ」（単一CTA）
 *
 * 二相構造に馴染ませる:
 *   - phase="story"    → 夜（墨黒 sumi + offwhite 文字）。Figma の夜の相そのもの。
 *   - phase="folklore" → 昼（生成り offwhite + sumi 文字）。解説生成の失敗。
 *
 * 固定文を無言で出さず、失敗を世界観のコピーで伝え、再試行 / モチーフ選び直し
 * の導線を必ず出す。色はすべてセマンティックトークン経由（直書き hex 無し）。
 *
 * Figma 寸法（夜・134:55 系基準）:
 *   glyph  : Shippori Mincho Bold 56px / red-on-dark（empty は sumi-3）
 *   lead   : Shippori Mincho Bold 24px leading 1.5 / offwhite
 *   body   : Noto Sans Regular 14px leading 1.7 / sumi-3（2行）
 *   gap    : content 内 20px / footer 8px / footer pb 40px px 16
 *   CTA    : h48 rounded-full bg red-accent offwhite Bold 16（統一 CTA 寸法）
 *   2nd    : h48 透明 text red-on-dark Bold 16
 */

export type GenerateErrorKind = "no-key" | "error" | "network" | "empty";

type Props = {
  phase: "story" | "folklore";
  kind: GenerateErrorKind;
  onRetry: () => void;
  onBackToMotif: () => void;
};

type Copy = {
  glyph: string;
  lead: string;
  body: [string, string];
  retryLabel: string;
  /** empty の場合は単一 CTA。secondary を出さない。 */
  showSecondary: boolean;
  /** glyph を sumi-3（くすみ）で出すか。empty のみ true。 */
  mutedGlyph: boolean;
};

// 怪談（夜）側の文言は Figma の確定文言をそのまま使う。
const STORY_COPY: Record<GenerateErrorKind, Copy> = {
  // 134:55 — 生成失敗
  error: {
    glyph: "祟",
    lead: "怪談は、姿を現さなかった",
    body: ["語り部が言葉を結べませんでした。", "もう一度、闇に呼びかけてみてください。"],
    retryLabel: "もう一度試す",
    showSecondary: true,
    mutedGlyph: false,
  },
  // 134:55 — 支度不足（APIキー未設定など）。Generation 系に寄せる。
  "no-key": {
    glyph: "祟",
    lead: "怪談は、姿を現さなかった",
    body: ["語り部の支度が、まだ整っていません。", "少し置いて、もう一度お試しください。"],
    retryLabel: "もう一度試す",
    showSecondary: true,
    mutedGlyph: false,
  },
  // 134:56 — 通信不通 / タイムアウト
  network: {
    glyph: "霧",
    lead: "声が、届かなかった",
    body: ["通信が途絶えています。", "電波の通う場所で、もう一度お試しください。"],
    retryLabel: "再接続する",
    showSecondary: true,
    mutedGlyph: false,
  },
  // 134:57 — モチーフ未選択
  empty: {
    glyph: "空",
    lead: "まだ、何も選ばれていません",
    body: ["怪談の種となるモチーフを選ぶと、", "ここに物語が立ち現れます。"],
    retryLabel: "モチーフを選ぶ",
    showSecondary: false,
    mutedGlyph: true,
  },
};

// 解説（昼）側。トーンは昼に合わせるが構造は同一。
const FOLKLORE_COPY: Record<GenerateErrorKind, Copy> = {
  error: {
    glyph: "翳",
    lead: "解説は、結べなかった",
    body: ["解き手が言葉をまとめられませんでした。", "もう一度お試しください。"],
    retryLabel: "もう一度試す",
    showSecondary: true,
    mutedGlyph: false,
  },
  "no-key": {
    glyph: "翳",
    lead: "解説は、結べなかった",
    body: ["解き手の支度が、まだ整っていません。", "少し置いて、もう一度お試しください。"],
    retryLabel: "もう一度試す",
    showSecondary: true,
    mutedGlyph: false,
  },
  network: {
    glyph: "霧",
    lead: "声が、届かなかった",
    body: ["通信が途絶えています。", "電波の通う場所で、もう一度お試しください。"],
    retryLabel: "再接続する",
    showSecondary: true,
    mutedGlyph: false,
  },
  empty: {
    glyph: "空",
    lead: "まだ、何も選ばれていません",
    body: ["怪談の種となるモチーフを選ぶと、", "ここに物語が立ち現れます。"],
    retryLabel: "モチーフを選ぶ",
    showSecondary: false,
    mutedGlyph: true,
  },
};

export default function GenerateError({
  phase,
  kind,
  onRetry,
  onBackToMotif,
}: Props) {
  const night = phase === "story";
  const copy = night ? STORY_COPY[kind] : FOLKLORE_COPY[kind];

  // 夜 / 昼でトークンだけ差し替える。レイアウトは Figma 134:55 系に共通化。
  const tokens = night
    ? {
        bg: "bg-sumi-0 lg:bg-sumi-0/80",
        text: "text-offwhite-2",
        glyphAccent: "text-red-on-dark",
        glyphMuted: "text-sumi-3",
        lead: "text-offwhite-2",
        body: "text-sumi-3",
        ctaBg: "bg-red-accent hover:bg-red-accent/90",
        ctaText: "text-offwhite-1",
        ctaFocus: "focus-visible:outline-red-accent",
        secondary: "text-red-on-dark",
        secondaryFocus: "focus-visible:outline-red-on-dark",
        statusBarText: "text-offwhite-2",
        ground: "bg-sumi-0",
        mode: "night" as const,
      }
    : {
        bg: "bg-offwhite-0 lg:bg-offwhite-0/85",
        text: "text-sumi-1",
        glyphAccent: "text-benigara",
        glyphMuted: "text-sumi-2",
        lead: "text-sumi-1",
        body: "text-sumi-2",
        ctaBg: "bg-benigara hover:bg-benigara/90",
        ctaText: "text-offwhite-1",
        ctaFocus: "focus-visible:outline-benigara",
        secondary: "text-benigara",
        secondaryFocus: "focus-visible:outline-benigara",
        statusBarText: "text-sumi-1",
        ground: "bg-offwhite-0",
        mode: "day" as const,
      };

  const glyphColor = copy.mutedGlyph ? tokens.glyphMuted : tokens.glyphAccent;

  return (
    <PCFrame mode={tokens.mode}>
      {/* 地レイヤー — 額装コラム内を absolute で覆う。モバイル(<440px)はコラムが
          全幅なので実 viewport を覆う＝safe-area/overscroll まで地色。PC では
          コラム内だけに閉じ、昼(day=offwhite)でも viewport 全面がクリームに
          ならず外側は暗い浮世絵 surround。色はモード別トークン駆動(直 hex なし)。 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 -z-10 ${tokens.ground}`}
      />
      <div
        className={`${tokens.bg} ${tokens.text} relative mx-auto flex min-h-dvh w-full max-w-[402px] flex-col min-[440px]:min-h-full`}
      >
        <StatusBar className={`${tokens.statusBarText} lg:hidden`} />

        {/* error-content (136:59) — flex-1, center, gap 20, px 40 */}
        <main
          className="flex flex-1 flex-col items-center justify-center gap-5 px-10 text-center"
          role={copy.mutedGlyph ? "status" : "alert"}
          aria-live={copy.mutedGlyph ? "polite" : "assertive"}
        >
          {/* glyph — Shippori Mincho Bold 56 */}
          <p className={`font-mincho text-[56px] font-bold leading-none ${glyphColor}`}>
            {copy.glyph}
          </p>
          {/* lead — Shippori Mincho Bold 24 leading 1.5 */}
          <h1 className={`font-mincho text-[24px] font-bold leading-[1.5] ${tokens.lead}`}>
            {copy.lead}
          </h1>
          {/* body — Noto Sans Regular 14 leading 1.7（2行） */}
          <p className={`font-sans text-[14px] leading-[1.7] ${tokens.body}`}>
            {copy.body[0]}
            <br />
            {copy.body[1]}
          </p>
        </main>

        {/* footer-actions (136:63) — gap 8, pb 40, px 16 */}
        <div
          className="flex flex-col items-center gap-2 px-4"
          style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={onRetry}
            className={`flex h-12 w-full items-center justify-center rounded-full px-4 text-[16px] font-bold leading-[1.4] transition-colors duration-150 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${tokens.ctaBg} ${tokens.ctaText} ${tokens.ctaFocus}`}
          >
            {copy.retryLabel}
          </button>
          {copy.showSecondary && (
            <button
              type="button"
              onClick={onBackToMotif}
              className={`flex h-12 w-full items-center justify-center rounded-full px-4 text-[16px] font-bold leading-[1.4] transition-opacity duration-150 hover:opacity-80 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${tokens.secondary} ${tokens.secondaryFocus}`}
            >
              モチーフを選び直す
            </button>
          )}
        </div>
      </div>
    </PCFrame>
  );
}
