import Link from "next/link";
import StatusBar from "@/components/StatusBar";
import PCFrame from "@/components/PCFrame";
import HistoryAccordion from "@/components/HistoryAccordion";

/**
 * Splash — Figma mobile 132:54 / PC 56:48 を 1:1 再現。
 * スマホ画面: ukiyo-e 壁紙(splash-phone) + legibility 0.45 + YOTOGI(Young Serif 80px,
 *   大文字) + 作成する CTA。PC: PCFrame が pc-splash-bg を全幅 + 墨 veil 0.6。splash は
 *   スマホに drop shadow なし(Figma 56:48)。
 */
export default function SplashPage() {
  return (
    <PCFrame mode="night" bgImage="/images/pc-splash-bg.jpg">
      {/* horror-app-rokurokubi-visual (132:91) — w402 / overflow-clip / bg-black */}
      <div
        className="relative mx-auto w-full max-w-[402px] overflow-hidden bg-black"
        style={{ height: "100dvh", minHeight: "100dvh" }}
      >
        {/* 履歴アコーディオン — 右上。開くと過去の怪談一覧。 */}
        <HistoryAccordion />

        {/* スマホ画面の壁紙(浮世絵 中央パネル) — Figma 132:55 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/splash-phone.jpg"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
        {/* legibility-overlay — Figma 132:94: rgba(0,0,0,0.45) 均一 */}
        <div className="absolute inset-0 z-[1] bg-[rgba(0,0,0,0.45)]" aria-hidden="true" />

        {/* safe-area-wrapper (132:95): justify-between, pb-40 */}
        <main className="relative z-10 flex h-full flex-col justify-between pb-[40px]">
          <div className="flex flex-col items-center">
            <StatusBar className="self-stretch" />
            {/* hero-section (132:106): pt-120 */}
            <div className="flex flex-col items-center pt-[120px]">
              {/* logo (132:108): Young Serif 80px / uppercase / leading-0.9 / 影 */}
              <h1
                className="w-full text-center font-young text-[80px] uppercase leading-[0.9] text-white"
                style={{ fontFamily: 'var(--font-young)', textShadow: "0px 2px 10px rgba(0,0,0,0.8)" }}
              >
                Yotogi
              </h1>
            </div>
          </div>

          {/* cta-container (132:109): w402 中央 */}
          <div className="flex w-full flex-col items-center">
            {/* cta-button (132:110): red/accent #D91C0B, h48, w343(max360,min132),
                rounded24, Noto Sans JP Bold 16, offwhite/1-surface */}
            <Link
              href="/motif"
              className="flex h-[48px] w-[343px] min-w-[132px] max-w-[360px] items-center justify-center rounded-[24px] bg-red-accent px-[16px] text-[16px] font-bold leading-[1.4] text-offwhite-1 transition-colors duration-150 hover:bg-red-accent/90 focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-accent"
            >
              作成する
            </Link>

          </div>
        </main>
      </div>
    </PCFrame>
  );
}
