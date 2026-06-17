import Link from "next/link";
import StatusBar from "@/components/StatusBar";
import PCFrame from "@/components/PCFrame";
import HistoryStrip from "@/components/HistoryStrip";

/**
 * Splash (Screen#Splash, Figma 9:2)
 * モバイル: 純黒 + Yotogi ロゴ + 赤 CTA
 * PC: PCFrame が浮世絵 bg を出す + 中央モバイル列は透過
 * CTA は Next.js Link で SSR ナビゲーション (JS なしでも遷移する)。
 *
 * 仕様: Figma 9:2 / cta = 11:182 (red/accent #D91C0B, h:48, w:343)
 */
export default function SplashPage() {
  return (
    <PCFrame mode="night" bgImage="/images/ukiyoe-takiyasha.jpg">
      {/* h-dvh で iPhone SE (667) など短 viewport でも CTA がフォールド下に
          埋没しないよう viewport 高さに固定する。スマホ画面は透過にし、PCFrame の
          全幅浮世絵(1枚)の明るい中央=このスマホ画面の壁紙として見せる。 */}
      <div
        className="relative mx-auto w-full max-w-[402px] overflow-hidden"
        style={{ height: "100dvh", minHeight: "100dvh" }}
      >
        {/* legibility-overlay — Figma 132:57: 上下を落として YOTOGI / CTA を可読に */}
        <div
          className="absolute inset-0 z-[1] bg-gradient-to-b from-sumi-0/70 via-sumi-0/15 to-sumi-0/85"
          aria-hidden="true"
        />

        {/* Figma safe-area-wrapper: justify-between, 下に余白。
            PC では logo を中央寄せ、CTA は下端固定 */}
        <main className="relative z-10 flex h-full flex-col justify-between pb-10">
          <div className="flex flex-col items-center">
            <StatusBar className="self-stretch" />
            <div className="flex flex-col items-center pt-[120px]">
              <h1
                className="font-mincho text-[48px] font-medium leading-none text-offwhite-1"
                style={{ textShadow: "0 2px 10px rgba(0,0,0,0.8)" }}
              >
                Yotogi
              </h1>
            </div>
          </div>

          {/* cta-container — Figma 11:182: bg red/accent, h-48, rounded-24,
              w 343 (max 360, min 132), Noto Sans Bold 16, offwhite-1 text */}
          <div className="flex flex-col items-center">
            <Link
              href="/motif"
              className="flex h-12 w-[343px] max-w-[360px] items-center justify-center rounded-[24px] bg-red-accent px-4 text-[16px] font-bold text-offwhite-1 transition-colors duration-150 hover:bg-red-accent/90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
            >
              作成する
            </Link>

            {/* 読み返す導線 — 履歴がある時だけ出る（client island） */}
            <HistoryStrip />
          </div>
        </main>
      </div>
    </PCFrame>
  );
}
