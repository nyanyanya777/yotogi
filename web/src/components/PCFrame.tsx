import type React from "react";

/**
 * PCFrame — Figma 3 層モデルのうち「中央 402px のスマホ列 + drop shadow」を担う。
 *
 * 背景(全幅 bg)と veil の 2 層は RootLayout 常駐の BackgroundLayer が描く
 * （遷移してもチラつかないよう据え置くため）。ここはコンテンツ列だけを中央寄せする。
 *
 * frameShadow はページ毎(Figma 56:48/56:73/56:110):
 *   splash=なし / story=`0 8 48 rgba(0,0,0,.4)` / folklore=`0 4 32 rgba(20,15,10,.12)`。
 *
 * mode / bgImage は呼び出し側の意図を表す目印として受け取るが、描画は
 * BackgroundLayer(pathname 駆動)が一元管理する。
 */
type PCFrameProps = {
  mode: "night" | "day";
  bgImage?: string;
  frameShadow?: "night" | "day" | false;
  children: React.ReactNode;
};

export default function PCFrame({ mode, frameShadow = false, children }: PCFrameProps) {
  const shadowClass =
    frameShadow === "night"
      ? "min-[440px]:shadow-[0px_8px_48px_0px_rgba(0,0,0,0.4)]"
      : frameShadow === "day"
        ? "min-[440px]:shadow-[0px_4px_32px_0px_rgba(20,15,10,0.12)]"
        : "";

  return (
    <div data-pcframe-mode={mode} className="relative min-h-screen w-full">
      <div
        className={
          "relative z-10 mx-auto min-h-screen w-full min-[440px]:max-w-[402px] " +
          shadowClass
        }
      >
        {children}
      </div>
    </div>
  );
}
