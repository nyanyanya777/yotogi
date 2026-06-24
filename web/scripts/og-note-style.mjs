// og-note-style.mjs — 「note風クリーン」OG。
//   思想: note のシェアOGが良く見えるのは "極限までシンプルでコンテンツとブランドしか
//   置いてない" から。匡郭/簾の目/走査線/蔵書印/ノンブル/巨大背景文字などの飾りは一切置かず、
//   フラットな単色地に「タイトル・さわり一行・著者行・隅の小さなサービス名」だけを左寄せで組む。
//   フォント読込は og-night-letterpress.mjs を流用(UAヘッダ無しでTTF取得→satoriで日本語OK)。
//   既存スクリプトは改変しない(複製して作成)。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- 配色: 実プロダクトUIの墨黒地 + 砂白/沈んだ銀。朱は著者の円マーク一点だけ。---
const BG     = "#0B0B0B"; // 墨黒の地(フラットな単色。テクスチャ/枠/グラデ無し)
const TITLE  = "#F5F2EA"; // タイトル = 砂白
const SUB    = "#8C8377"; // さわり / 著者ハンドル = 沈んだ銀
const NAME   = "#E7E1D8"; // 著者名「YOTOGI」
const RED     = "#D91C0B"; // 朱 = 著者の円マーク一点のみ
const ONRED  = "#F5F2EA"; // 円マーク中の白記号

// UA を送らずに Google Fonts から TTF を引く(satori 可・豆腐回避の既知修正)
async function loadSubset(family, texts, weight) {
  const chars = Array.from(new Set(texts.join("").split(""))).join("");
  if (!chars) return null;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family) + ":wght@" + weight +
      "&text=" + encodeURIComponent(chars);
    const cssRes = await fetch(cssUrl);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
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

// --- コンテンツ ---
const TITLE_TXT = "深夜のエレベーター";                       // 記事タイトル(明朝・大)
const SUB_TXT   = "四階で止まるはずのない箱が、止まった。";   // さわり一行(明朝・落着いた銀)
const MARK_TXT  = "夜";                                       // 円マーク中の白記号
const NAME_TXT  = "YOTOGI";                                   // 著者名(sans)
const HANDLE    = "@yotogi";                                  // ハンドル(sans)
const CORNER    = "YOTOGI 怪談 / ネットロア";                 // 隅の小さなサービス名(sans)

// 描画する全文字をサブセットに必ず含める(漏れ=豆腐)
const serifBoldTexts = [TITLE_TXT, MARK_TXT];
const serifRegTexts  = [SUB_TXT];
const sansTexts      = [NAME_TXT, HANDLE, CORNER];

const [serifBold, serifReg, sans] = await Promise.all([
  loadSubset("Noto Serif JP", serifBoldTexts, 700),
  loadSubset("Noto Serif JP", serifRegTexts, 400),
  loadSubset("Noto Sans JP", sansTexts, 500),
]);

const fonts = [];
if (serifBold) fonts.push({ name: "Noto Serif JP", data: serifBold, weight: 700, style: "normal" });
if (serifReg)  fonts.push({ name: "Noto Serif JP", data: serifReg,  weight: 400, style: "normal" });
if (sans)      fonts.push({ name: "Noto Sans JP",  data: sans,      weight: 500, style: "normal" });
console.log("fonts loaded:", { serif: !!serifBold, serifReg: !!serifReg, sans: !!sans });
if (!serifBold || !serifReg || !sans) {
  console.error("FONT LOAD FAILED — abort to avoid tofu");
  process.exit(1);
}

const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
const sansFam = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

// note のシェアOG構造: フラット単色地・左寄せ・たっぷり余白。
//   上に「タイトル(大) → さわり一行」、下端に「著者行」と「隅の小さなサービス名」。
const tree = h("div", {
  style: {
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    backgroundColor: BG,
    fontFamily: serif, color: TITLE,
    padding: "84px 92px 60px 92px",
    justifyContent: "space-between",
  },
}, [
  // ── 上ブロック: タイトル + さわり一行 ─────────────────────────
  h("div", { key: "hero", style: { display: "flex", flexDirection: "column" } }, [
    h("div", {
      key: "title",
      style: {
        display: "flex", fontWeight: 700, fontSize: 84, lineHeight: 1.3,
        letterSpacing: 1, color: TITLE, maxWidth: 1000,
      },
    }, TITLE_TXT),
    h("div", {
      key: "sub",
      style: {
        display: "flex", fontWeight: 400, fontSize: 31, lineHeight: 1.75,
        color: SUB, marginTop: 30, maxWidth: 920, letterSpacing: 0.5,
      },
    }, SUB_TXT),
  ]),

  // ── 下端: 著者行(左) + サービス名(右) ─────────────────────
  h("div", {
    key: "footer",
    style: { display: "flex", flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  }, [
    // 著者行: 円マーク(朱・白記号) + 著者名 + ハンドル
    h("div", { key: "author", style: { display: "flex", flexDirection: "row", alignItems: "center" } }, [
      h("div", {
        key: "mark",
        style: {
          display: "flex", width: 58, height: 58, borderRadius: 58,
          backgroundColor: RED, alignItems: "center", justifyContent: "center",
          marginRight: 22,
        },
      }, h("div", {
        key: "marktxt",
        style: { display: "flex", fontFamily: serif, fontWeight: 700, fontSize: 28, color: ONRED, lineHeight: 1 },
      }, MARK_TXT)),
      h("div", { key: "names", style: { display: "flex", flexDirection: "column" } }, [
        h("div", {
          key: "name",
          style: { display: "flex", fontFamily: sansFam, fontWeight: 500, fontSize: 27, color: NAME, letterSpacing: 1 },
        }, NAME_TXT),
        h("div", {
          key: "handle",
          style: { display: "flex", fontFamily: sansFam, fontWeight: 500, fontSize: 20, color: SUB, marginTop: 5, letterSpacing: 0.5 },
        }, HANDLE),
      ]),
    ]),
    // 隅の小さなサービス名
    h("div", {
      key: "corner",
      style: { display: "flex", fontFamily: sansFam, fontWeight: 500, fontSize: 19, color: SUB, letterSpacing: 1.5 },
    }, CORNER),
  ]),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_og_note_style_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
