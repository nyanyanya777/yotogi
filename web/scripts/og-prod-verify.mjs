// og-prod-verify.mjs — 本番ルート（opengraph-image.tsx）と同じ描画ロジック
//   （@/lib/ogShared）を使って代表サンプルで OG を焼き、豆腐・溢れを目視検証する。
//   dev server / Chrome 不使用・ImageResponse 直叩き。出力は workspace 直下へ。
import { ImageResponse } from "next/og.js";
import { writeFileSync } from "node:fs";
import {
  buildOgTree,
  loadJaSansSubset,
  prepareOgContent,
  BG,
  TITLE,
  SUB,
  NAME,
} from "../src/lib/ogShared.mjs";

const FONT_FAMILY = "Noto Sans JP";

// --- WCAG コントラスト比チェック（全テキスト色 on 地）。AAA: 通常 7:1 / 大 4.5:1 ---
function relLum(hex) {
  const n = hex.replace("#", "");
  const ch = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function contrast(fg, bg) {
  const a = relLum(fg) + 0.05;
  const b = relLum(bg) + 0.05;
  return (Math.max(a, b) / Math.min(a, b));
}
console.log("=== コントラスト比 on", BG, "(AAA 通常7:1 / 大4.5:1) ===");
for (const [label, hex] of [
  ["タイトル", TITLE],
  ["さわり/小文字(SUB)", SUB],
  ["著者名(NAME)", NAME],
]) {
  const r = contrast(hex, BG);
  console.log(`  ${label.padEnd(20)} ${hex}  ${r.toFixed(2)}:1  ${r >= 7 ? "AAA✓" : r >= 4.5 ? "大AAA✓" : "✗"}`);
}

// 代表サンプル: getShare の返り値（{title, body, tags}）相当を直接与える。
const SAMPLES = [
  {
    name: "short",
    shared: {
      title: "深夜のエレベーター",
      body: "四階で止まるはずのない箱が、止まった。",
      tags: ["都市伝説"],
    },
  },
  {
    name: "long",
    shared: {
      title:
        "誰もいないはずの夜勤の病棟で、ナースコールだけが何度も何度も鳴り続けた話",
      body:
        "ナースコールのランプは三〇二号室。けれどそこは先週から誰も入っていない空室のはずで、私は受話器を取る手が止まらなかった。背後で、もう一つランプが点く。",
      tags: ["病院", "実話怪談", "深夜"],
    },
  },
  {
    name: "fallback",
    shared: null, // share 欠損 → 既定値で描画
  },
];

async function bake({ name, shared }) {
  const { title, teaser, titleFontSize, subsetBold, subsetMid, subsetReg } =
    prepareOgContent(shared);

  const [boldFont, midFont, regFont] = await Promise.all([
    loadJaSansSubset(FONT_FAMILY, subsetBold, 700),
    loadJaSansSubset(FONT_FAMILY, subsetMid, 500),
    loadJaSansSubset(FONT_FAMILY, subsetReg, 400),
  ]);

  const fonts = [];
  if (boldFont) fonts.push({ name: FONT_FAMILY, data: boldFont, weight: 700, style: "normal" });
  if (midFont) fonts.push({ name: FONT_FAMILY, data: midFont, weight: 500, style: "normal" });
  if (regFont) fonts.push({ name: FONT_FAMILY, data: regFont, weight: 400, style: "normal" });
  console.log(`[${name}] fonts:`, { bold: !!boldFont, mid: !!midFont, reg: !!regFont },
    `titleFontSize=${titleFontSize}`, `titleLen=${[...title].length}`, `teaserLen=${[...teaser].length}`);

  const resp = new ImageResponse(buildOgTree({ title, teaser, titleFontSize }), {
    width: 1200,
    height: 630,
    fonts: fonts.length > 0 ? fonts : undefined,
  });
  const buf = Buffer.from(await resp.arrayBuffer());
  const out = `/Users/kohei/.openclaw/workspace/yotogi_og_prod_${name}_2026-06-22.png`;
  writeFileSync(out, buf);
  console.log(`[${name}] WROTE ${out} ${buf.length} bytes`);
}

for (const s of SAMPLES) await bake(s);
console.log("DONE");
