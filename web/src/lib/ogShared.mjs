/**
 * ogShared.mjs — `/s/[id]` OG 画像（1200×630）の描画ロジックの単一情報源。
 *
 * 本番ルート（opengraph-image.tsx）と検証スクリプト（scripts/og-prod-verify.mjs）が
 * 同じ「フォント取得・サブセット・可変長サイズ計算・レイアウト構築」をここから読む。
 * デザインは確定版 scripts/og-note-sans.mjs（note 風フル版・全文字 Noto Sans JP）が基。
 * ただし配色は全テキスト白系に転換済み（暗いグレーで弱めず、階層は余白＋級数＋ウェイト）。
 *
 * 豆腐(tofu)対策の要点:
 *   - Google Fonts に **UA ヘッダを送らない**。`&text=` サブセット時、UA 無し（または
 *     非ブラウザ UA）なら TTF を返す。モダン UA を送ると woff2 になり satori が
 *     読めず日本語が豆腐化する（検証済みの回避策）。
 *   - 描画する全文字（タイトル＋さわり＋固定文字「夜 / YOTOGI / 怪談 / ネットロア /
 *     @yotogi / …」）をサブセット対象に必ず含める（漏れ＝豆腐）。
 *   - フォント取得に失敗しても **例外で落とさない**。読めたウェイトだけ使い、
 *     全滅時は fonts 無しで（英数のみ）描画継続する。
 */

import { createElement as h } from "react";

// --- 配色: 全テキスト白系。階層は「色の暗さ」ではなく余白(margin)＋級数＋ウェイトで作る ---
// （暗いグレー #8C8377 は廃止。地 #0B0B0B に対し全色 AAA=7:1 を余裕で満たす明るさに統一）
export const BG = "#0B0B0B"; // 墨黒の地（フラット）
export const TITLE = "#F5F2EA"; // タイトル = 砂白（最も明るい・主役）
export const SUB = "#E7E1D8"; // さわり / ハンドル / 隅サービス名 = 僅かに落とした白（旧 #8C8377）
export const NAME = "#E7E1D8"; // 著者名「YOTOGI」
export const RED = "#D91C0B"; // 朱 = 著者の円マーク一点のみ
export const ONRED = "#F5F2EA"; // 円マーク中の白記号

// 固定文字（描画される＝サブセットに必須）
export const MARK_TXT = "夜"; // 円マーク中の白記号（700）
export const NAME_TXT = "YOTOGI"; // 著者名（500）
export const HANDLE = "@yotogi"; // ハンドル（400）
export const CORNER = "YOTOGI 怪談 / ネットロア"; // 隅のサービス名（500）
export const ELLIPSIS = "…"; // トランケート記号

// 全テキストで使う唯一のファミリ（明朝は使わない）
export const SANS_FAM = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

// share 欠損 / さわり欠落時の既定値
const DEFAULT_TITLE = "YOTOGI / ネットロア";
const DEFAULT_TEASER = "選んだモチーフから怪談を紡ぐ、AI時代のネットロア";

// 可変長トランケートの上限（サブセットを無闇に肥大させない実用上限）
const MAX_TITLE_CHARS = 48;
const MAX_TEASER_CHARS = 60;

/**
 * Google Fonts から `&text=` サブセット（TTF）を取得する。**UA は送らない**。
 * @param {string} family  例: "Noto Sans JP"
 * @param {string[]} texts 実際に描画する文字列群
 * @param {number} weight  例: 400 | 500 | 700
 * @returns {Promise<ArrayBuffer|null>} 取得失敗時は null（呼び出し側でガード）
 */
export async function loadJaSansSubset(family, texts, weight) {
  const chars = Array.from(new Set(texts.join("").split(""))).join("");
  if (!chars) return null;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family) +
      ":wght@" +
      weight +
      "&text=" +
      encodeURIComponent(chars);
    // UA ヘッダを付けない＝TTF が返る（豆腐回避の既知修正）。
    const cssRes = await fetch(cssUrl);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    // truetype を明示する src を優先採用（woff2/EOT を誤って掴まない）。
    const m =
      css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\(['"]truetype['"]\)/) ??
      css.match(/src:\s*url\((https:\/\/[^)]+\.ttf)\)/);
    if (!m) return null;
    const fontRes = await fetch(m[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

/** 全角=1.0 / 半角(ASCII)=0.55 で重み付けした「見かけの幅」を返す。 */
function weightedLen(s) {
  let w = 0;
  for (const ch of s) w += /[ -ÿ]/.test(ch) ? 0.55 : 1;
  return w;
}

/**
 * タイトルの字数に応じてフォントサイズを自動決定する（2 行以内に収める想定）。
 * maxWidth≈1000 の 2 行ぶん(≈1950 の幅予算)を見かけ幅で割り、84〜48 にクランプ。
 * 例: 短題 84 / 中題 60 前後 / 長題 48。
 */
export function pickTitleFontSize(title) {
  const w = weightedLen(title);
  if (w <= 0) return 84;
  const fs = Math.round(1950 / w);
  return Math.max(48, Math.min(84, fs));
}

/** 文字列を最大 n 文字に丸め、超過時は末尾に「…」を付す。 */
function truncate(s, n) {
  const arr = Array.from(s);
  return arr.length > n ? arr.slice(0, n).join("") + ELLIPSIS : s;
}

/**
 * getShare の生データ（{ title, body } | null）から、描画に使う確定テキストと
 * サブセット対象・タイトルフォントサイズをまとめて算出する。
 * @param {{title?: string, body?: string}|null} shared
 */
export function prepareOgContent(shared) {
  const rawTitle = (shared?.title ?? "").replace(/\s+/g, " ").trim();
  const title = truncate(rawTitle || DEFAULT_TITLE, MAX_TITLE_CHARS);

  const rawBody = (shared?.body ?? "").replace(/\s+/g, " ").trim();
  const teaser = rawBody ? truncate(rawBody, MAX_TEASER_CHARS) : DEFAULT_TEASER;

  const titleFontSize = pickTitleFontSize(title);

  // ウェイト別サブセット対象（描画する全文字を漏れなく）。
  const subsetBold = [title, MARK_TXT, ELLIPSIS]; // 700
  const subsetMid = [NAME_TXT, CORNER]; // 500
  const subsetReg = [teaser, HANDLE, ELLIPSIS]; // 400

  return { title, teaser, titleFontSize, subsetBold, subsetMid, subsetReg };
}

/**
 * 確定版 note 風レイアウトの要素ツリーを構築する（createElement なので .tsx/.mjs 両用）。
 * @param {{title: string, teaser: string, titleFontSize: number}} c
 */
export function buildOgTree({ title, teaser, titleFontSize }) {
  return h(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: BG,
        fontFamily: SANS_FAM,
        color: TITLE,
        padding: "84px 92px 60px 92px",
        justifyContent: "space-between",
      },
    },
    [
      // ── 上ブロック: タイトル（可変サイズ・2 行クランプ）+ さわり一行（2 行クランプ） ──
      h(
        "div",
        { key: "hero", style: { display: "flex", flexDirection: "column" } },
        [
          h(
            "div",
            {
              key: "title",
              style: {
                // satori で line-clamp を効かせる組み合わせは display:block + lineClamp。
                // （display:flex や -webkit-box ではクランプされない＝実測で確認済み）。
                display: "block",
                fontWeight: 700,
                fontSize: titleFontSize,
                lineHeight: 1.3,
                letterSpacing: 1,
                color: TITLE,
                maxWidth: 1000,
                // 2 行を超えたら末尾を「…」で自動省略する。
                lineClamp: 2,
              },
            },
            title,
          ),
          h(
            "div",
            {
              key: "sub",
              style: {
                display: "block", // lineClamp を効かせるため（title と同じ理由）。
                fontWeight: 400,
                fontSize: 31,
                lineHeight: 1.75,
                color: SUB,
                // 色を白系に統一したぶん、階層は「タイトル下の広い余白」で作る（旧 30 → 48）。
                marginTop: 48,
                maxWidth: 920,
                letterSpacing: 0.5,
                lineClamp: 2,
              },
            },
            teaser,
          ),
        ],
      ),

      // ── 下端: 著者行（左）+ サービス名（右） ──
      h(
        "div",
        {
          key: "footer",
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-end",
            justifyContent: "space-between",
          },
        },
        [
          // 著者行: 円マーク(朱・白記号) + 著者名 + ハンドル
          h(
            "div",
            {
              key: "author",
              style: { display: "flex", flexDirection: "row", alignItems: "center" },
            },
            [
              h(
                "div",
                {
                  key: "mark",
                  style: {
                    display: "flex",
                    width: 58,
                    height: 58,
                    borderRadius: 58,
                    backgroundColor: RED,
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 22,
                  },
                },
                h(
                  "div",
                  {
                    key: "marktxt",
                    style: {
                      display: "flex",
                      fontFamily: SANS_FAM,
                      fontWeight: 700,
                      fontSize: 28,
                      color: ONRED,
                      lineHeight: 1,
                    },
                  },
                  MARK_TXT,
                ),
              ),
              h(
                "div",
                {
                  key: "names",
                  style: { display: "flex", flexDirection: "column" },
                },
                [
                  h(
                    "div",
                    {
                      key: "name",
                      style: {
                        display: "flex",
                        fontFamily: SANS_FAM,
                        fontWeight: 500,
                        fontSize: 27,
                        color: NAME,
                        letterSpacing: 1,
                      },
                    },
                    NAME_TXT,
                  ),
                  h(
                    "div",
                    {
                      key: "handle",
                      style: {
                        display: "flex",
                        fontFamily: SANS_FAM,
                        fontWeight: 400,
                        fontSize: 20,
                        color: SUB,
                        marginTop: 8,
                        letterSpacing: 0.5,
                      },
                    },
                    HANDLE,
                  ),
                ],
              ),
            ],
          ),
          // 隅の小さなサービス名
          h(
            "div",
            {
              key: "corner",
              style: {
                display: "flex",
                fontFamily: SANS_FAM,
                fontWeight: 500,
                fontSize: 19,
                color: SUB,
                letterSpacing: 1.5,
              },
            },
            CORNER,
          ),
        ],
      ),
    ],
  );
}
