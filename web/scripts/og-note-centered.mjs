// og-note-centered.mjs — 中央ミニマル版OG。
//   og-note-style.mjs を複製し、要素を削いで中央寄せにしたミニマル版。
//   残すのは「タイトル」と「さわり一行」の2要素だけ。著者行・隅のサービス名・装飾は全削除。
//   レンダリング基盤(UAヘッダ無しTTF取得 + ImageResponse直叩き、地 #0B0B0B、明朝)は流用。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- 配色: フラットな墨黒地 + 砂白(タイトル) + 沈んだ銀(さわり)---
const BG    = "#0B0B0B"; // 墨黒の地(フラット単色・装飾なし)
const TITLE = "#F5F2EA"; // タイトル = 砂白
const SUB   = "#8C8377"; // さわり一行 = 沈んだ銀

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

// --- コンテンツ(残す2要素だけ)---
const TITLE_TXT = "深夜のエレベーター";                       // タイトル(明朝・大)
const SUB_TXT   = "四階で止まるはずのない箱が、止まった。";   // さわり一行(明朝・銀)

// 描画する全文字をサブセットに必ず含める(漏れ=豆腐)
const [serifBold, serifReg] = await Promise.all([
  loadSubset("Noto Serif JP", [TITLE_TXT], 700),
  loadSubset("Noto Serif JP", [SUB_TXT], 400),
]);

const fonts = [];
if (serifBold) fonts.push({ name: "Noto Serif JP", data: serifBold, weight: 700, style: "normal" });
if (serifReg)  fonts.push({ name: "Noto Serif JP", data: serifReg,  weight: 400, style: "normal" });
console.log("fonts loaded:", { serifBold: !!serifBold, serifReg: !!serifReg });
if (!serifBold || !serifReg) {
  console.error("FONT LOAD FAILED — abort to avoid tofu");
  process.exit(1);
}

const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';

// 中央ミニマル構造: フラット単色地・水平中央+垂直中央。装飾なし。
//   中央に「タイトル(大) → 少し余白 → さわり一行」をセンター揃えで縦に積む。
const tree = h("div", {
  style: {
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    backgroundColor: BG,
    fontFamily: serif, color: TITLE,
    alignItems: "center", justifyContent: "center",
    padding: "0 92px",
  },
}, [
  h("div", {
    key: "title",
    style: {
      display: "flex", fontWeight: 700, fontSize: 84, lineHeight: 1.3,
      letterSpacing: 1, color: TITLE, textAlign: "center",
    },
  }, TITLE_TXT),
  h("div", {
    key: "sub",
    style: {
      display: "flex", fontWeight: 400, fontSize: 31, lineHeight: 1.75,
      color: SUB, marginTop: 34, letterSpacing: 0.5, textAlign: "center",
    },
  }, SUB_TXT),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_og_note_centered_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
