/**
 * opengraph-image.tsx — `/s/[id]` 共有怪談の動的 OG 画像（1200×630 / PNG）。
 *
 * X / LINE / Slack 等にリンクが貼られた際に表示される og:image / twitter:image を
 * その怪談ごとに生成する。Next.js のファイル規約により自動で
 * `<meta property="og:image">` / `<meta name="twitter:image">` に配線される
 * （`generateMetadata` 側で手動指定する必要はない）。
 *
 * デザインは確定版「note 風フル版・全文字 Noto Sans JP」（scripts/og-note-sans.mjs）と
 * 同一: フラット墨黒地に、左寄せでタイトル（砂白・700）→ さわり一行（白系・400）、
 * 下端に著者行（朱の円マーク＋夜＋YOTOGI＋@yotogi）と隅のサービス名。配色は全テキスト
 * 白系（暗いグレー廃止・階層は余白＋級数＋ウェイト）。横線・枠・タグ
 * ピル・テクスチャ・ビネットは無し。描画・サブセット・可変長サイズの実ロジックは
 * `@/lib/ogShared`（本番ルートと検証スクリプトの単一情報源）に集約している。
 *
 * 動的・可変長対応:
 *   - タイトル/さわりは getShare の実データ（title / body）を流し込む（決め打ちしない）。
 *   - タイトルは字数に応じて fontSize を自動縮小（84→48）し 2 行でクランプ。
 *   - さわりは body を一行化して 60 字でトランケート＋2 行クランプ。
 *
 * 豆腐(tofu)対策: ImageResponse（satori）はシステムフォントで漢字/かなを描けないため、
 * 実際に描画する文字だけを Google Fonts の `&text=` サブセットで取得して fonts に渡す。
 * このとき **UA ヘッダを送らない**（送ると woff2 が返り satori が読めず豆腐化する）。
 * 取得失敗時はフォント無しで描画継続しクラッシュさせない。@vercel/blob を使う getShare
 * のため runtime は nodejs。
 */

import { ImageResponse } from "next/og";
import { getShare } from "@/lib/getShare";
import {
  buildOgTree,
  loadJaSansSubset,
  prepareOgContent,
} from "@/lib/ogShared.mjs";

// @vercel/blob（Node API）の getShare を使うため Node runtime を強制。
export const runtime = "nodejs";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "YOTOGI — 怪談";

const FONT_FAMILY = "Noto Sans JP";

type OgFont = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 500 | 700;
  style: "normal";
};

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const shared = await getShare(id);

  // 実データ（title / body）→ 描画テキスト・タイトルサイズ・サブセット対象を確定。
  const { title, teaser, titleFontSize, subsetBold, subsetMid, subsetReg } =
    prepareOgContent(shared);

  // ウェイト別に Noto Sans JP のサブセットを取得（UA 無し＝TTF・豆腐回避）。
  const [boldFont, midFont, regFont] = await Promise.all([
    loadJaSansSubset(FONT_FAMILY, subsetBold, 700),
    loadJaSansSubset(FONT_FAMILY, subsetMid, 500),
    loadJaSansSubset(FONT_FAMILY, subsetReg, 400),
  ]);

  // 読めたウェイトだけ採用。全滅でも fonts 無しで描画継続（クラッシュさせない）。
  const fonts: OgFont[] = [];
  if (boldFont)
    fonts.push({ name: FONT_FAMILY, data: boldFont, weight: 700, style: "normal" });
  if (midFont)
    fonts.push({ name: FONT_FAMILY, data: midFont, weight: 500, style: "normal" });
  if (regFont)
    fonts.push({ name: FONT_FAMILY, data: regFont, weight: 400, style: "normal" });

  return new ImageResponse(buildOgTree({ title, teaser, titleFontSize }), {
    ...size,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
}
