// og-sample.mjs — opengraph-image.tsx の設計と同じ描画でサンプル OG を 1 枚生成。
// getShare（Vercel Blob 依存）は使わず、サンプルの怪談データを直接流し込む。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

const SUMI_0 = "#0B0B0B";
const SUMI_3 = "#A09890";
const OFFWHITE_2 = "#F0EBE5";
const RED_ON_DARK = "#FF614A";
const SAND_RULE = "#C8BC9E";

async function loadJaSerifSubset(texts, weight) {
  const chars = Array.from(new Set(texts.join("").split(""))).join("");
  if (!chars) return null;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@" +
      weight + "&text=" + encodeURIComponent(chars);
    // UA を送らないと Google Fonts は format('truetype') の TTF を返す（satori 可）。
    // モダン UA だと woff2 が返り satori が使えないため、ここでは UA を付けない。
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

// --- サンプルの怪談 ---
const shared = {
  title: "深夜のエレベーター",
  body: "四階で止まるはずのない箱が、止まった。",
  tags: ["実話怪談", "エレベーター"],
};

const rawTitle = shared.title.trim() || "YOTOGI / ネットロア";
const title = rawTitle.length > 42 ? `${rawTitle.slice(0, 42)}…` : rawTitle;
const flat = shared.body.replace(/\s+/g, " ").trim();
const teaser = flat
  ? flat.length > 56 ? `${flat.slice(0, 56)}…` : flat
  : "選んだモチーフから怪談を紡ぐ、AI時代のネットロア";
const tags = shared.tags.slice(0, 3);
const brand = "YOTOGI";

const boldTexts = [title];
const regularTexts = [teaser, ...tags.map((t) => `# ${t}`), "怪談 / ネットロア"];

const [boldFont, regularFont] = await Promise.all([
  loadJaSerifSubset(boldTexts, 600),
  loadJaSerifSubset(regularTexts, 400),
]);

const fonts = [];
if (boldFont) fonts.push({ name: "Noto Serif JP", data: boldFont, weight: 600, style: "normal" });
if (regularFont) fonts.push({ name: "Noto Serif JP", data: regularFont, weight: 400, style: "normal" });
console.log("fonts loaded:", { bold: !!boldFont, regular: !!regularFont });

const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';

const tree = h("div", {
  style: {
    width: "100%", height: "100%", display: "flex", flexDirection: "column",
    justifyContent: "space-between", background: SUMI_0,
    backgroundImage: "radial-gradient(120% 100% at 50% 38%, rgba(28,24,20,0.55) 0%, rgba(11,11,11,0.0) 55%)",
    padding: "72px 88px", fontFamily: serif, color: OFFWHITE_2,
  },
}, [
  h("div", { key: "hdr", style: { display: "flex", alignItems: "center" } }, [
    h("div", { key: "bar", style: { width: 6, height: 40, background: RED_ON_DARK, marginRight: 20 } }),
    h("div", { key: "brand", style: { fontSize: 30, letterSpacing: 8, color: OFFWHITE_2, fontWeight: 400 } }, brand),
  ]),
  h("div", { key: "body", style: { display: "flex", flexDirection: "column" } }, [
    h("div", { key: "title", style: { fontSize: 72, lineHeight: 1.3, fontWeight: 600, color: OFFWHITE_2, display: "flex" } }, title),
    h("div", { key: "rule", style: { width: 96, height: 2, background: SAND_RULE, margin: "32px 0" } }),
    h("div", { key: "teaser", style: { fontSize: 30, lineHeight: 1.8, color: SUMI_3, fontWeight: 400, display: "flex" } }, teaser),
  ]),
  h("div", { key: "ftr", style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
    h("div", { key: "tags", style: { display: "flex", gap: 16 } },
      tags.map((t, i) => h("div", {
        key: i,
        style: { display: "flex", fontSize: 24, color: SAND_RULE, fontWeight: 400, border: `1px solid ${SAND_RULE}`, borderRadius: 9999, padding: "8px 22px" },
      }, `# ${t}`)),
    ),
    h("div", { key: "foot", style: { fontSize: 24, color: SUMI_3, fontWeight: 400, display: "flex" } }, "怪談 / ネットロア"),
  ]),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_og_sample_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
