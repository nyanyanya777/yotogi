// og-variant-cinema.mjs — YOTOGI 共有OGの「シネマポスター」版。
// 本番ルート / og-sample.mjs は改変しない。これは独立した実験スクリプト。
// 方向性: ホラー映画キービジュアル。上下シネスコ黒帯、下三分の一にどっしりした
// 改行タイトル、上部にクレジット風キッカー、血紅は一点だけ。
// 質感は複数グラデの重ねで非対称な光源＋暗部、走査線は repeating-linear-gradient。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- palette ---
const INK = "#06060A";        // 最暗部の墨
const FILM_BLACK = "#000000"; // レターボックス帯
const PAPER = "#ECE5D8";      // 退色した印画紙の白（タイトル）
const ASH = "#8C8377";        // 灰（タグライン）
const FAINT = "#6A6258";      // さらに沈んだ灰（クレジット）
const BLOOD = "#C21B11";      // 血紅 — 一点だけ
const BLOOD_DIM = "#7E1B14";  // 紅の沈んだ縁

async function loadGoogleFontSubset(family, texts, weight) {
  const chars = Array.from(new Set(texts.join("").split(""))).join("");
  if (!chars) return null;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=" +
      family.replace(/ /g, "+") + ":wght@" + weight +
      "&text=" + encodeURIComponent(chars);
    // UA を送らないと Google Fonts は TTF(format truetype) を返す（satori 可）。
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

// --- サンプル怪談（固定）---
const shared = {
  title: "深夜のエレベーター",
  body: "四階で止まるはずのない箱が、止まった。",
  tags: ["実話怪談", "エレベーター"],
};

const rawTitle = shared.title.trim() || "YOTOGI";
const title = rawTitle.length > 42 ? `${rawTitle.slice(0, 42)}…` : rawTitle;
const flat = shared.body.replace(/\s+/g, " ").trim();
const tagline = flat.length > 40 ? `${flat.slice(0, 40)}…` : flat;
const tags = shared.tags.slice(0, 3);

// 劇的な改行: 1/3 あたりで折る（"深夜の" / "エレベーター"）。
const cut = Math.max(2, Math.ceil(title.length / 3));
const titleLines = title.length > 5 ? [title.slice(0, cut), title.slice(cut)] : [title];

const kickerLatin = "A YOTOGI KAIDAN";
const credit = tags.join(" ・ ");

// --- フォント ---
const serifTexts = [...titleLines, tagline];
const sansTexts = [kickerLatin, credit, "実話怪談", "YOTOGI 怪談 / ネットロア"];

const [titleFont, taglineFont, sansFont] = await Promise.all([
  loadGoogleFontSubset("Noto Serif JP", titleLines, 700),
  loadGoogleFontSubset("Noto Serif JP", [tagline], 400),
  loadGoogleFontSubset("Noto Sans JP", sansTexts, 500),
]);

const fonts = [];
if (titleFont) fonts.push({ name: "Noto Serif JP", data: titleFont, weight: 700, style: "normal" });
if (taglineFont) fonts.push({ name: "Noto Serif JP", data: taglineFont, weight: 400, style: "normal" });
if (sansFont) fonts.push({ name: "Noto Sans JP", data: sansFont, weight: 500, style: "normal" });
console.log("fonts loaded:", { title: !!titleFont, tagline: !!taglineFont, sans: !!sansFont });

const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
const sans = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

const BAR = 64; // シネスコ帯の高さ

// 背景: 複数グラデを重ねて光源を右上に寄せ、左下に暗部。中央きっかりの放射にしない。
const bgImage = [
  // 走査線（極薄）
  "repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0px, rgba(255,255,255,0.022) 1px, rgba(0,0,0,0) 1px, rgba(0,0,0,0) 3px)",
  // 紅の微かな滲み — 一点（右上やや内側）
  "radial-gradient(38% 42% at 76% 26%, rgba(150,24,16,0.20) 0%, rgba(150,24,16,0) 68%)",
  // 主光源（非対称・右上の冷たい灯り）
  "radial-gradient(90% 120% at 74% 14%, rgba(70,58,52,0.62) 0%, rgba(70,58,52,0) 52%)",
  // 左下の深い暗部
  "radial-gradient(95% 95% at 16% 112%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 58%)",
  // 下方向への沈み込み
  "linear-gradient(180deg, rgba(0,0,0,0) 30%, rgba(0,0,0,0.55) 100%)",
].join(", ");

const tree = h("div", {
  style: {
    position: "relative",
    width: "100%", height: "100%", display: "flex",
    background: INK,
    backgroundImage: bgImage,
    fontFamily: serif, color: PAPER,
  },
}, [
  // --- シネスコ レターボックス帯 ---
  h("div", { key: "topbar", style: {
    position: "absolute", top: 0, left: 0, width: "100%", height: BAR,
    background: FILM_BLACK, borderBottom: "1px solid rgba(255,255,255,0.05)",
  } }),
  h("div", { key: "botbar", style: {
    position: "absolute", bottom: 0, left: 0, width: "100%", height: BAR,
    background: FILM_BLACK, borderTop: "1px solid rgba(255,255,255,0.05)",
  } }),

  // --- コンテンツ（帯の内側）---
  h("div", { key: "content", style: {
    position: "absolute", top: BAR, left: 0,
    width: "100%", height: 630 - BAR * 2,
    display: "flex", flexDirection: "column", justifyContent: "space-between",
    padding: "44px 92px 40px",
  } }, [
    // 上: クレジット風キッカー（紅の点 = 一点アクセント）
    h("div", { key: "kicker", style: { display: "flex", alignItems: "center" } }, [
      h("div", { key: "dot", style: {
        width: 9, height: 9, background: BLOOD,
        boxShadow: `0 0 14px 2px ${BLOOD_DIM}`, marginRight: 18,
      } }),
      h("div", { key: "klat", style: {
        fontFamily: sans, fontSize: 21, letterSpacing: 7, fontWeight: 500,
        color: ASH, display: "flex",
      } }, kickerLatin),
    ]),

    // 下: タイトル群（劇的改行）＋ タグライン ＋ クレジット
    h("div", { key: "lower", style: { display: "flex", flexDirection: "column" } }, [
      h("div", { key: "title", style: { display: "flex", flexDirection: "column", marginBottom: 26 } },
        titleLines.map((ln, i) => h("div", {
          key: i,
          style: {
            display: "flex", fontFamily: serif, fontWeight: 700,
            fontSize: 116, lineHeight: 1.0, letterSpacing: 2, color: PAPER,
            textShadow: "0 4px 30px rgba(0,0,0,0.85)",
            marginLeft: i === 1 ? 64 : 0, // 2行目を字下げして版面に動き
          },
        }, ln)),
      ),
      h("div", { key: "tagline", style: {
        display: "flex", fontFamily: serif, fontWeight: 400,
        fontSize: 27, lineHeight: 1.6, color: ASH, marginBottom: 22,
      } }, tagline),
      h("div", { key: "credit", style: {
        display: "flex", alignItems: "center", justifyContent: "space-between",
      } }, [
        h("div", { key: "tags", style: {
          fontFamily: sans, fontSize: 21, letterSpacing: 3, fontWeight: 500,
          color: FAINT, display: "flex",
        } }, credit),
        h("div", { key: "brand", style: {
          fontFamily: sans, fontSize: 19, letterSpacing: 5, fontWeight: 500,
          color: FAINT, display: "flex",
        } }, "YOTOGI 怪談 / ネットロア"),
      ]),
    ]),
  ]),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_variant_cinema_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
