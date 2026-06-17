/**
 * PCFrame — スマホ1デザイン(402px)を中央に、PC余白も含め1枚の背景で満たすラッパー。
 *
 * Figma PCフレーム(56:48/56:73/56:110)準拠の考え方:
 *   背景画像(bgImage)は全幅フルブリードの「1枚」。中央402pxは veil を掛けず明るい
 *   ままにして「スマホ画面」に見せ、その左右だけを暗く落とす。これにより
 *   ・浮世絵を二重に重ねない(画像は1枚)
 *   ・黒い余白に箱が浮く感じにならない(余白も同じ画像の暗部)
 *
 *   - home(splash): スマホ画面の壁紙＝この背景そのもの。スマホ側を透過にして
 *     中央に明るい浮世絵が出る(壁紙の可読化オーバーレイはページ側)。
 *   - story/motif/folklore: スマホは単色。中央の単色スマホが左右の暗い画像から浮く。
 *
 * 中央のveil非適用は440px以上のみ(未満はスマホが全幅)。
 */
type PCFrameProps = {
  mode: "night" | "day";
  /** 全幅フルブリードで敷く背景画像。省略時は無地。 */
  bgImage?: string;
  children: React.ReactNode;
};

export default function PCFrame({ mode, bgImage, children }: PCFrameProps) {
  // 左右(余白)に掛ける帳。中央を明るく残すため脇だけ落とす。
  const veilClass =
    mode === "night"
      ? "bg-[rgba(11,11,11,0.66)]"
      : "bg-[rgba(245,242,234,0.5)]";

  const surroundClass = mode === "night" ? "bg-sumi-0" : "bg-offwhite-0";

  // 中央402px=端末画面の縁。薄いringで境界を締める(影は出さない=浮き箱感を避ける)。
  const edgeClass =
    mode === "night"
      ? "min-[440px]:ring-1 min-[440px]:ring-white/10"
      : "min-[440px]:ring-1 min-[440px]:ring-black/10";

  return (
    <div data-pcframe-mode={mode} className="relative min-h-screen w-full">
      {bgImage ? (
        // 背景画像は全幅1枚・モバイルでも表示(homeの壁紙になる)
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgImage}
          alt=""
          aria-hidden="true"
          loading="eager"
          className="pointer-events-none fixed inset-0 z-0 h-full w-full object-cover"
        />
      ) : (
        <div
          aria-hidden="true"
          className={`pointer-events-none fixed inset-0 z-0 ${surroundClass}`}
        />
      )}

      {/* 左右の帳 — 中央402pxを避けて両脇だけ暗く(440px以上のみ) */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-y-0 left-0 right-[calc(50%+201px)] z-[1] hidden min-[440px]:block ${veilClass}`}
      />
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-y-0 left-[calc(50%+201px)] right-0 z-[1] hidden min-[440px]:block ${veilClass}`}
      />

      {/* 中央の端末画面(402px固定) */}
      <div
        className={`relative z-10 mx-auto min-h-screen w-full min-[440px]:max-w-[402px] ${edgeClass}`}
      >
        {children}
      </div>
    </div>
  );
}
