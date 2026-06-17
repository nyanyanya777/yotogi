/**
 * PCFrame — スマホ1デザイン(402px)を中央に置き、PCの余白を埋めるラッパー。
 *
 * 原則(Figma準拠): 浮世絵は1画面に1回だけ。
 *   - スマホ画面自体が画像背景を持つ画面(例: splash=浮世絵)では bgImage を渡さない
 *     → 周囲は無地(夜=墨/昼=生成り)。スマホ画面の壁紙はページ側で描く。
 *   - スマホ画面が単色の画面(story/motif=墨, folklore=生成り)では bgImage に
 *     周囲用の画像(浮世絵/砂浜)を渡す → 中央の単色スマホが画像から浮く。
 *
 * 440px 以上で発動。中央402pxは ring+影 で常に端末画面として立たせる。
 * 実 <img> なので SSR から bg が出る(ハイドレーション前後で真っ黒にならない)。
 */
type PCFrameProps = {
  mode: "night" | "day";
  /** 周囲(PC余白)に敷く画像。省略時は無地の余白。 */
  bgImage?: string;
  children: React.ReactNode;
};

export default function PCFrame({ mode, bgImage, children }: PCFrameProps) {
  // 周囲の無地色(bgImage 省略時)。夜は body(bg-sumi-0)に任せ、昼は生成り。
  const surroundClass = mode === "night" ? "bg-sumi-0" : "bg-offwhite-0";

  // bgImage 使用時、その上に重ねる帳(veil)。中央を立たせるため脇を落とす。
  const veilClass =
    mode === "night"
      ? "bg-[rgba(11,11,11,0.74)]"
      : "bg-[rgba(245,242,234,0.55)]";

  // 中央402px=端末画面。ring+ドロップシャドウで余白から浮かせる。
  const frameClass =
    mode === "night"
      ? "min-[440px]:shadow-[0_10px_60px_rgba(0,0,0,0.75)] min-[440px]:ring-1 min-[440px]:ring-white/15"
      : "min-[440px]:shadow-[0_10px_48px_rgba(20,15,10,0.28)] min-[440px]:ring-1 min-[440px]:ring-black/10";

  return (
    <div data-pcframe-mode={mode} className="relative min-h-screen w-full">
      {bgImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bgImage}
            alt=""
            aria-hidden="true"
            loading="eager"
            className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full object-cover min-[440px]:block"
          />
          <div
            aria-hidden="true"
            className={`pointer-events-none fixed inset-0 z-[1] hidden min-[440px]:block ${veilClass}`}
          />
        </>
      ) : (
        // 無地の周囲(440px以上のみ。未満はスマホ画面が全幅なので不要)
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-0 hidden min-[440px]:block ${surroundClass}`}
        />
      )}

      {/* 中央の端末画面(402px固定) */}
      <div
        className={`relative z-10 mx-auto min-h-screen w-full min-[440px]:max-w-[402px] ${frameClass}`}
      >
        {children}
      </div>
    </div>
  );
}
