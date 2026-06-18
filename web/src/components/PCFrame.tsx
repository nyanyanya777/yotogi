import type React from "react";

/**
 * PCFrame — 額装モデルの「中央 402px 列 + 掛軸風フレーム(枠＋影)」を担う。
 *
 * 周囲(フルブリード浮世絵 + 暗幕＋放射ビネット)は RootLayout 常駐の
 * BackgroundLayer が全ルート統一で描く。ここは中央列を中央寄せし、
 * 額装フレーム(細い内側ストローク + soft drop shadow)を付けて列を周囲から
 * 持ち上げる(globals: .yotogi-frame ＝ ≥440px だけで効く media gate 済み)。
 * 掛軸/額装の落ち着いたホラー寄りの質感。<440px はフルブリード(影/枠なし)。
 *
 * フレーミングは全ルート(このコンポーネントを使う全ページ)で UNIFORM。
 * 列自身の地色(夜=墨 / 昼=和紙)は呼び出し側ページの内側 div が持つ。
 *
 * mode / frameShadow は呼び出し側の意図の目印として後方互換で受け取る
 * (フレームの見た目は全ルート共通 .yotogi-frame に一本化)。
 */
type PCFrameProps = {
  mode: "night" | "day";
  frameShadow?: "night" | "day" | false;
  children: React.ReactNode;
};

export default function PCFrame({ mode, children }: PCFrameProps) {
  return (
    <div data-pcframe-mode={mode} className="relative min-h-dvh w-full">
      <div
        className={
          // 中央寄せ。≥440px で max-w-[402px] に絞り、yotogi-frame で額装(枠＋影)。
          // overflow-hidden は付けない: story の sticky footer の固定ふるまいを
          // 壊さないため(overflow を付けるとコラムが scroll container 化する)。
          // 枠は box-shadow の内側 1px ストロークで表現する。
          "yotogi-frame relative z-10 mx-auto min-h-dvh w-full min-[440px]:max-w-[402px]"
        }
      >
        {children}
      </div>
    </div>
  );
}
