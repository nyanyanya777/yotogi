/**
 * PCFrame — PC レスポンシブ汎用ラッパー
 *
 * 1024px 以上: bg画像 (実 <img>) + veil を全画面に敷き、中央 max-w-[402px] の
 *              モバイル画面を浮かせる（drop shadow）。
 * 1024px 未満: bg画像は `hidden` で非表示。モバイル画面はそのまま表示される。
 *
 * 実 <img> タグで SSR から bg が出るので、ハイドレーション前後で真っ黒にならない。
 * `loading=eager` で First Paint に間に合わせる。
 *
 * 仕様: /root/YOTOGI_IMPLEMENTATION_SPEC.md §3.6–3.9
 */
type PCFrameProps = {
  mode: "night" | "day";
  bgImage: string;
  children: React.ReactNode;
};

export default function PCFrame({ mode, bgImage, children }: PCFrameProps) {
  // 1024px 以上での veil 色
  // night: sumi/0-black #0B0B0B @ 0.62
  // day:   offwhite/0-base #F5F2EA @ 0.45
  const veilClass =
    mode === "night"
      ? "bg-[rgba(11,11,11,0.62)]"
      : "bg-[rgba(245,242,234,0.45)]";

  // モバイル領域 drop shadow（夜=深い影で sink、昼=控えめな影で lift）
  const shadowClass =
    mode === "night"
      ? "min-[440px]:shadow-[0_8px_48px_rgba(0,0,0,0.4)]"
      : "min-[440px]:shadow-[0_4px_32px_rgba(20,15,10,0.12)]";

  return (
    <div
      data-pcframe-mode={mode}
      className="relative min-h-screen w-full"
    >
      {/* bg image — SSR で <img> として出るので JS なしで First Paint に間に合う。
          z-0 で body bg-sumi-0 (layout.tsx) より上に出す */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={bgImage}
        alt=""
        aria-hidden="true"
        loading="eager"
        className="pointer-events-none fixed inset-0 z-0 hidden h-full w-full object-cover min-[440px]:block"
      />

      {/* veil — bg画像の上、コンテンツの下 */}
      <div
        aria-hidden="true"
        className={`pointer-events-none fixed inset-0 z-[1] hidden min-[440px]:block ${veilClass}`}
      />

      {/* 中央モバイル領域 — lg 以上で max-w-[402px] mx-auto と shadow */}
      <div
        className={`relative z-10 mx-auto w-full min-[440px]:max-w-[402px] ${shadowClass}`}
      >
        {children}
      </div>
    </div>
  );
}
