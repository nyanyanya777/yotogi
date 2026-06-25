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
 * ★ 黒帯(#0b0b0b body)封じの肝:
 *   1〜3 の「面(surface)」は、入れ子の min-h-dvh チェーン(PCFrame×2 → 列 → main)の
 *   高さ計算に依存させず、surface 親を <440px では `fixed inset-0`(実 viewport に直ピン)、
 *   ≥440px では `absolute inset-0`(額装 402 パネル内に閉じる)に切り替える。
 *   これにより iOS Safari の dvh/safe-area/ツールバー収縮/ゴムバンドで列が実高さに
 *   届かなくても、面は常に実 viewport を 100% 覆い、CTA より下に黒が出ない。
 *   面は pointer-events-none で、上の UI 階層(CTA/履歴)の操作を妨げない。
 */
export default function SplashPage() {
  return (
    <PCFrame mode="night">
      {/* スマホ画面 = 骸骨ビジュアル。w402 / 縦は min-h-dvh で伸縮 */}
      <div className="relative mx-auto flex w-full min-h-dvh max-w-[402px] flex-col overflow-hidden min-[440px]:min-h-full">
        {/* 面(surface)親 — <440px は fixed inset-0(実 viewport 直ピン) /
            ≥440px は absolute inset-0(額装パネル内に閉じる)。pointer-events-none で
            上の UI を妨げない。overflow-hidden は object-cover のはみ出しを切る。 */}
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-0 overflow-hidden min-[440px]:absolute"
        >
          {/* 1) 地 — 暗い墨のグラデ。画像が出る前/失敗時もこの下地が見え、純黒ベタにならない。 */}
          <div
            className="absolute inset-0 z-0"
            style={{
              background:
                "linear-gradient(180deg, var(--color-sumi-1) 0%, var(--color-sumi-0) 100%)",
            }}
          />

          {/* 2) 画像 — 骸骨(がしゃどくろ)。主役(骸骨＋武者)で画面を満たすため scale で
              少し寄せ、object-position と transform-origin を骸骨に合わせる。これで上下端に出る
              「空(上)/床(下)」の暗い余白が画面外へ送られ、実機(セーフエリア)でも黒帯に見えない。
              左右は主役が切れないよう中央。inset-0 で親の高さ確定に依存しない。
              LCP となるヒーロー画像なので fetchPriority="high" + eager で先読みヒントを与える。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/skeleton-phone.jpg"
            alt=""
            aria-hidden="true"
            fetchPriority="high"
            loading="eager"
            className="absolute inset-0 z-[1] h-full w-full scale-[1.12] object-cover [object-position:50%_36%] [transform-origin:50%_36%]"
          />

          {/* 3) 可読スクリム — 上下の帯のみ(中央は素の骸骨)。
              上帯=ロゴ可読 / 下帯=CTA可読。放射/スポット無し・縦一様の帯。 */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-[2]"
            style={{
              background:
                // smoothstep(3t²−2t³)を2%刻みで離散化した帯。サンプリングを細かくし、
                // 隣接ストップ間の傾き変化を知覚閾値以下に抑えることで、変曲点の横線(マッハバンド)を消す。
                // 透明区間との境界(44%/60%)では傾きが0に収束。上=ロゴ帯 / 下=CTA帯は維持。
                "linear-gradient(180deg, rgba(11,11,11,0.72) 0%, rgba(11,11,11,0.7157) 2%, rgba(11,11,11,0.7032) 4%, rgba(11,11,11,0.6835) 6%, rgba(11,11,11,0.6573) 8%, rgba(11,11,11,0.6253) 10%, rgba(11,11,11,0.5885) 12%, rgba(11,11,11,0.5477) 14%, rgba(11,11,11,0.5036) 16%, rgba(11,11,11,0.4571) 18%, rgba(11,11,11,0.409) 20%, rgba(11,11,11,0.36) 22%, rgba(11,11,11,0.311) 24%, rgba(11,11,11,0.2629) 26%, rgba(11,11,11,0.2164) 28%, rgba(11,11,11,0.1723) 30%, rgba(11,11,11,0.1315) 32%, rgba(11,11,11,0.0947) 34%, rgba(11,11,11,0.0627) 36%, rgba(11,11,11,0.0365) 38%, rgba(11,11,11,0.0168) 40%, rgba(11,11,11,0.0043) 42%, rgba(11,11,11,0) 44%, rgba(11,11,11,0) 60%, rgba(11,11,11,0.0062) 62%, rgba(11,11,11,0.0241) 64%, rgba(11,11,11,0.0522) 66%, rgba(11,11,11,0.0894) 68%, rgba(11,11,11,0.1344) 70%, rgba(11,11,11,0.1858) 72%, rgba(11,11,11,0.2423) 74%, rgba(11,11,11,0.3027) 76%, rgba(11,11,11,0.3657) 78%, rgba(11,11,11,0.43) 80%, rgba(11,11,11,0.4943) 82%, rgba(11,11,11,0.5573) 84%, rgba(11,11,11,0.6177) 86%, rgba(11,11,11,0.6742) 88%, rgba(11,11,11,0.7256) 90%, rgba(11,11,11,0.7706) 92%, rgba(11,11,11,0.8078) 94%, rgba(11,11,11,0.8359) 96%, rgba(11,11,11,0.8538) 98%, rgba(11,11,11,0.86) 100%)",
            }}
          />
        </div>

        {/* 履歴アコーディオン — 右上。開くと過去の怪談一覧。 */}
        <HistoryAccordion />

        {/* UI 階層 — safe-area を含めて配置。上=ロゴ帯 / 下=CTA帯。
            面が背後で実 viewport を覆うので、main の高さが端数でも黒は出ない。 */}
        <main
          className="relative z-10 flex min-h-dvh flex-col justify-between min-[440px]:flex-1"
          style={{
            paddingTop: "env(safe-area-inset-top)",
            paddingBottom: "calc(24px + env(safe-area-inset-bottom))",
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
