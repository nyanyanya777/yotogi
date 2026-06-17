/**
 * PCFrame — スマホ1デザイン(402px固定)を中央に置き、周囲を浮世絵背景で埋める。
 *
 * 440px 以上:
 *   - bg画像(実 <img>)を全画面フルブリード
 *   - 周囲は veil で落とし、中央 402px の「端末画面」を縁(ring)+影で浮かせる
 * 440px 未満: bg画像は hidden。スマホデザインがそのまま全幅で出る。
 *
 * 実 <img> なので SSR から bg が出る(ハイドレーション前後で真っ黒にならない)。
 */
type PCFrameProps = {
  mode: "night" | "day";
  bgImage: string;
  children: React.ReactNode;
};

export default function PCFrame({ mode, bgImage, children }: PCFrameProps) {
  // 周囲の帳(veil)。中央の端末画面を立たせるため、脇はしっかり落とす。
  const veilClass =
    mode === "night"
      ? "bg-[rgba(11,11,11,0.74)]"
      : "bg-[rgba(245,242,234,0.55)]";

  // 中央402px=「端末画面」。縁(ring)+ドロップシャドウで浮世絵から浮かせる。
  const frameClass =
    mode === "night"
      ? "min-[440px]:shadow-[0_10px_60px_rgba(0,0,0,0.75)] min-[440px]:ring-1 min-[440px]:ring-white/15"
      : "min-[440px]:shadow-[0_10px_48px_rgba(20,15,10,0.28)] min-[440px]:ring-1 min-[440px]:ring-black/10";

  return (
    <div data-pcframe-mode={mode} className="relative min-h-screen w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgImage}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full object-cover min-[440px]:block"
      />

      {/* 周囲の帳 — bg画像の上、端末画面の下 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[1] hidden min-[440px]:block ${veilClass}`}
      />

      {/* 中央の端末画面(402px固定) */}
      <div
        className={`relative z-10 mx-auto min-h-screen w-full min-[440px]:max-w-[402px] ${frameClass}`}
      >
        {children}
      </div>
    </div>
  );
}
