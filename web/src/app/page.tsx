import StatusBar from "@/components/StatusBar";
import PCFrame from "@/components/PCFrame";
import HistoryAccordion from "@/components/HistoryAccordion";
import PrimaryCTA from "@/components/PrimaryCTA";

/**
 * Splash（トップ）— がしゃどくろ(骸骨)を主役に、夜の入口を見せる起動画面。
 *
 * 面の分離（画像にベタ乗りしない）:
 *   1) 地        … 暗い墨のグラデ(下地)。画像のロード/失敗時もここが出るので黒ベタにならない。
 *   2) 画像      … 骸骨を absolute inset-0 で敷き、頭部が見えるよう object-position を上寄せ。
 *   3) 可読スクリム … 上端→透明→下端の縦グラデ「帯」のみ(上=ロゴ帯 / 下=CTA帯)。
 *                   中央スポット/放射ビネット無し・上下均一の帯のみ。中央の骸骨は素の明るさを残す。
 *   4) UI 階層   … ロゴは上帯の上、CTA は下帯の上に置き、画像とは別レイヤーで読ませる。
 *
 * PC 周囲背景(ろくろ首)と veil は RootLayout 常駐の BackgroundLayer が描く。
 * 高さは min-h-dvh（100dvh 固定をやめ、オーバースクロール/ツールバー収縮でも黒を出さない。
 * 地は RootBackground(fixed)が viewport 全面を覆う）。
 */
export default function SplashPage() {
  return (
    <PCFrame mode="night">
      {/* スマホ画面 = 骸骨ビジュアル。w402 / 縦は min-h-dvh で伸縮 */}
      <div className="relative mx-auto flex w-full min-h-dvh max-w-[402px] flex-col overflow-hidden min-[440px]:min-h-full">
        {/* 1) 地 — 暗い墨のグラデ。画像が出る前/失敗時もこの下地が見え、純黒ベタにならない。 */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-0"
          style={{
            background:
              "linear-gradient(180deg, var(--color-sumi-1) 0%, var(--color-sumi-0) 100%)",
          }}
        />

        {/* 2) 画像 — 骸骨(がしゃどくろ)。頭部を見せるため object-position を上寄せ、
            左右は主役が切れないよう中央。inset-0 で親の高さ確定に依存しない。
            LCP となるヒーロー画像なので fetchPriority="high" + eager で先読みヒントを与える。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/skeleton-phone.jpg"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
          loading="eager"
          className="absolute inset-0 z-[1] h-full w-full object-cover [object-position:50%_28%]"
        />

        {/* 3) 可読スクリム — 上下の帯のみ(中央は素の骸骨)。
            上帯=ロゴ可読 / 下帯=CTA可読。放射/スポット無し・縦一様の帯。 */}
        <div
          aria-hidden="true"
          className="absolute inset-0 z-[2]"
          style={{
            background:
              "linear-gradient(180deg, rgba(11,11,11,0.72) 0%, rgba(11,11,11,0.30) 24%, rgba(11,11,11,0) 44%, rgba(11,11,11,0) 60%, rgba(11,11,11,0.55) 82%, rgba(11,11,11,0.86) 100%)",
          }}
        />

        {/* 履歴アコーディオン — 右上。開くと過去の怪談一覧。 */}
        <HistoryAccordion />

        {/* UI 階層 — safe-area を含めて配置。上=ロゴ帯 / 下=CTA帯 */}
        <main
          className="relative z-10 flex min-h-dvh flex-col justify-between min-[440px]:flex-1"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "calc(40px + env(safe-area-inset-bottom))",
          }}
        >
          <div className="flex flex-col items-center">
            <StatusBar className="self-stretch" />
            {/* hero — サブキャッチ(上)→ロゴ(下・大)の階層。Young Serif 80px / uppercase / 影で更に分離 */}
            <div className="flex flex-col items-center pt-[120px]">
              {/* サブキャッチ — ロゴの上、上帯の上に階層を持って置く。 */}
              <p
                className="mb-4 text-center font-mincho text-[15px] leading-[1.8] text-offwhite-2"
                style={{ textShadow: "0px 1px 8px rgba(0,0,0,0.7)" }}
              >
                怪談を生成するアプリ
              </p>
              <h1
                className="w-full text-center font-young text-[80px] uppercase leading-[0.9] text-white"
                style={{
                  fontFamily: "var(--font-young)",
                  textShadow: "0px 2px 14px rgba(0,0,0,0.85)",
                }}
              >
                Yotogi
              </h1>
            </div>
          </div>

          {/* CTA — 下帯の上。左右 px-4 で他画面と同じマージン感。統一 PrimaryCTA。 */}
          <div className="flex w-full flex-col items-center px-4">
            <PrimaryCTA href="/motif" label="作成する" variant="primary" />
          </div>
        </main>
      </div>
    </PCFrame>
  );
}
