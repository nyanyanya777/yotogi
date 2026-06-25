// og-note-eyecatch.mjs — note のアイキャッチ(シェアOG)に寄せたクリーン版。
//   参照: https://note.com/yuna_kj_/n/n279c49b4a22d
//   そのOGは「記事のアイキャッチ写真そのもの」= フルブリードの暗い写真一枚、
//   文字オーバーレイ無し・枠無し・横罫無し・丸ピルタグ無し。note は写真の空気感を
//   そのまま見せるのが流儀。ここではYOTOGIに必要な文字(タイトル/さわり/ブランド)は
//   残しつつ、それ以外の装飾(タイトル下の罫線・区切り線・丸ピル型タグ・著者アバター丸・
//   ハンドル・隅タグ)を全廃。地はフラットな死黒ではなく、天井灯のような淡いグローを
//   一点だけ載せた写真的な暗がりにして「一枚の静止画」の空気に寄せる。
//   フォント読込は og-note-style.mjs を流用(UAヘッダ無しでTTF取得→豆腐回避)。
//   既存スクリプトは非破壊(別名で新規作成)。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- 配色: 実プロダクトUIの墨黒地 + 砂白/沈んだ銀。朱は極小の点一つだけ。---
const BG    = "#0B0B0B"; // 墨黒の地
const TITLE = "#F5F2EA"; // タイトル = 砂白
const SUB   = "#8C8377"; // さわり = 沈んだ銀
const NAME  = "#E7E1D8"; // ブランド YOTOGI
const RED   = "#D91C0B"; // 朱 = ブランド前の極小ドット一点のみ

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

// --- コンテンツ(既存どおり) ---
const TITLE_TXT = "深夜のエレベーター";
const SUB_TXT   = "四階で止まるはずのない箱が、止まった。";
const NAME_TXT  = "YOTOGI";

// 描画する全文字をサブセットに必ず含める(漏れ=豆腐)
const serifBoldTexts = [TITLE_TXT];
const serifRegTexts  = [SUB_TXT];
const sansTexts      = [NAME_TXT];

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

// note のアイキャッチOG = フルブリードの暗い一枚絵。横罫/枠/ピル/アバター丸/ハンドルは無し。
//   地は死黒ではなく、天井灯のような淡い暖色グローを上部に一点だけ載せて
//   「深夜のエレベーター」の写真的な静止画の空気に寄せる(テクスチャ・走査線・匡郭は置かない)。
const tree = h("div", {
  style: {
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    backgroundColor: BG,
    // 上中央からの淡いグロー → 下は黒へ沈む。罫線ではなく光だけ。
    backgroundImage:
      "radial-gradient(95% 75% at 50% -8%, #1C1813 0%, #120F0D 38%, #0B0B0B 72%)",
    fontFamily: serif, color: TITLE,
    padding: "92px 96px",
    justifyContent: "flex-end", // 下三分の一に文字を寄せる映画スチル的な組み
  },
}, [
  // ── 一枚絵のロワーサード: タイトル → さわり ────────────────
  h("div", { key: "hero", style: { display: "flex", flexDirection: "column" } }, [
    h("div", {
      key: "title",
      style: {
        display: "flex", fontWeight: 700, fontSize: 88, lineHeight: 1.28,
        letterSpacing: 1, color: TITLE, maxWidth: 1000,
      },
    }, TITLE_TXT),
    h("div", {
      key: "sub",
      style: {
        display: "flex", fontWeight: 400, fontSize: 32, lineHeight: 1.75,
        color: SUB, marginTop: 28, maxWidth: 940, letterSpacing: 0.5,
      },
    }, SUB_TXT),
    // ── ブランド: 朱の極小ドット + YOTOGI(横罫もピルも無し) ──
    h("div", {
      key: "brand",
      style: { display: "flex", flexDirection: "row", alignItems: "center", marginTop: 56 },
    }, [
      h("div", {
        key: "dot",
        style: { display: "flex", width: 11, height: 11, borderRadius: 11, backgroundColor: RED, marginRight: 16 },
      }),
      h("div", {
        key: "name",
        style: { display: "flex", fontFamily: sansFam, fontWeight: 500, fontSize: 24, color: NAME, letterSpacing: 5 },
      }, NAME_TXT),
    ]),
  ]),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_og_note_eyecatch_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
