/**
 * PCFrame — Figma PCフレーム(56:48 / 56:73 / 56:110)を 1:1 で再現するラッパー。
 *
 * 構造(3層, いずれも440px以上で発動。未満はスマホ画面が全幅):
 *   1. bgImage を全幅フルブリード(object-cover)
 *   2. 全面 veil … 夜=sumi/0-black #0B0B0B @0.6 / 昼=offwhite/0-base #F5F2EA @0.45
 *      (Figma night-veil-* / day-veil。実測値)
 *   3. 中央 402px のスマホ画面(=children)。明るさ差で浮く。drop shadow は
 *      ページ毎(splash=なし / story=0 8 48 .4 / folklore=0 4 32 .12)なので
 *      frameShadow で受ける。
 */
type PCFrameProps = {
  mode: "night" | "day";
  bgImage?: string;
  /** Figma 各フレームのスマホ drop shadow。splash は false。 */
  frameShadow?: "night" | "day" | false;
  children: React.ReactNode;
};

export default function PCFrame({
  mode,
  bgImage,
  frameShadow = false,
  children,
}: PCFrameProps) {
  const veilClass =
    mode === "night"
      ? "bg-[rgba(11,11,11,0.6)]"
      : "bg-[rgba(245,242,234,0.45)]";

  const shadowClass =
    frameShadow === "night"
      ? "min-[440px]:shadow-[0px_8px_48px_0px_rgba(0,0,0,0.4)]"
      : frameShadow === "day"
        ? "min-[440px]:shadow-[0px_4px_32px_0px_rgba(20,15,10,0.12)]"
        : "";

  return (
    <div data-pcframe-mode={mode} className="relative min-h-screen w-full">
      {bgImage && (
        <>
          {/* 1. 全幅フルブリード背景 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgImage}
            alt=""
            aria-hidden="true"
            loading="eager"
            className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full object-cover min-[440px]:block"
          />
          {/* 2. 全面 veil */}
          <div
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 z-[1] hidden min-[440px]:block ${veilClass}`}
          />
        </>
      )}

      {/* 3. 中央402pxのスマホ画面 */}
      <div
        className={`relative z-10 mx-auto min-h-screen w-full min-[440px]:max-w-[402px] ${shadowClass}`}
      >
        {children}
      </div>
    </div>
  );
}
