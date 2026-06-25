// og-variant-minimal.mjs — 方向「ミニマル不穏（余白で殺す）」
// 画面の大半を“何もない闇”にし、背面に巨大で希薄な「四」を幽霊のように沈める。
// 前面はグリッドを外して隅に寄せた極小の活字ロックアップのみ。chip 禁止・飾り罫なし。
// 本番ルート / og-sample.mjs は改変しない。新規スクリプト。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- 配色（最小色数） ---
const SUMI = "#080807";        // ほぼ無の闇（背景）
const GHOST = "#16120D";       // 巨大文字。墨に溶ける灰（超低コントラスト）
const INK_HI = "#E7E1D8";      // タイトル（オフホワイト）
const INK_LO = "#5E574E";      // 本文・タグ（沈んだ灰）
const INK_FAINT = "#332E28";   // ブランド極小（さらに沈める）
const RED = "#E03A26";         // 紅。一点だけ・極小

// og-sample.mjs の loadJaSerifSubset を流用（UAヘッダ無し＝豆腐回避の既知修正）。
// family を引数化して Noto Sans JP（巨大数字/漢字用）も同要領で引けるようにした。
async function loadJaSubset(family, texts, weight) {
  const chars = Array.from(new Set(texts.join("").split(""))).join("");
  if (!chars) return null;
  try {
    const cssUrl =
      "https://fonts.googleapis.com/css2?family=" +
      encodeURIComponent(family) + ":wght@" + weight +
      "&text=" + encodeURIComponent(chars);
    // UA を送らないと Google Fonts は format('truetype') の TTF を返す（satori 可）。
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

// --- サンプル怪談（固定） ---
const shared = {
  title: "深夜のエレベーター",
  body: "四階で止まるはずのない箱が、止まった。",
  tags: ["実話怪談", "エレベーター"],
};

const title = shared.title.trim();
const body = shared.body.replace(/\s+/g, " ").trim();
const tags = shared.tags.slice(0, 3);
const brand = "YOTOGI";
const tagline = tags.join("・"); // 中黒区切り。pill 禁止。

// 巨大モチーフは「四」一文字。
const ghostChar = "四";

const serifTexts = [title, body, tagline, brand];
const sansTexts = [ghostChar];

const [serifReg, serifBold, sansGhost] = await Promise.all([
  loadJaSubset("Noto Serif JP", serifTexts, 400),
  loadJaSubset("Noto Serif JP", [title], 600),
  loadJaSubset("Noto Sans JP", sansTexts, 900),
]);

const fonts = [];
if (serifReg) fonts.push({ name: "Noto Serif JP", data: serifReg, weight: 400, style: "normal" });
if (serifBold) fonts.push({ name: "Noto Serif JP", data: serifBold, weight: 600, style: "normal" });
if (sansGhost) fonts.push({ name: "Noto Sans JP", data: sansGhost, weight: 900, style: "normal" });
console.log("fonts loaded:", { serifReg: !!serifReg, serifBold: !!serifBold, sansGhost: !!sansGhost });

const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
const sans = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

const tree = h("div", {
  style: {
    position: "relative",
    width: "100%", height: "100%", display: "flex",
    background: SUMI,
    // ごく弱い偏心ビネット。中央放射の“安全な”グラデは使わない。右下を僅かに持ち上げ闇を不均一に。
    backgroundImage:
      "radial-gradient(80% 70% at 88% 96%, rgba(40,33,26,0.40) 0%, rgba(8,8,7,0.0) 60%)",
    fontFamily: serif,
    color: INK_HI,
    overflow: "hidden",
  },
}, [
  // 巨大な「四」。背面・希薄。右下にめり込ませてフレームから切れさせる（不安）。
  h("div", {
    key: "ghost",
    style: {
      position: "absolute",
      right: -118,
      bottom: -236,
      fontSize: 880,
      lineHeight: 1,
      fontFamily: sans,
      fontWeight: 900,
      color: GHOST,
      display: "flex",
    },
  }, ghostChar),

  // 前面ロックアップ。グリッドを外し左上寄りやや下に小さく置く。
  h("div", {
    key: "lockup",
    style: {
      position: "absolute",
      left: 96,
      top: 150,
      display: "flex",
      flexDirection: "column",
      maxWidth: 560,
    },
  }, [
    // ブランド：極小・沈める。区切りは余白のみ。
    h("div", {
      key: "brand",
      style: {
        display: "flex", alignItems: "center",
        fontSize: 17, letterSpacing: 7, color: INK_FAINT,
        fontFamily: sans, fontWeight: 400, marginBottom: 34,
      },
    }, [
      // 紅は一点だけ・極小（3pxの点）。
      h("div", { key: "dot", style: { width: 4, height: 4, background: RED, marginRight: 12 } }),
      h("div", { key: "bt", style: { display: "flex" } }, brand),
    ]),
    // タイトル：中見出し級に抑える（巨大化しない）。中央寄せにしない。
    h("div", {
      key: "title",
      style: {
        fontSize: 46, lineHeight: 1.45, fontWeight: 600,
        color: INK_HI, display: "flex",
      },
    }, title),
    // 本文：さらに小さく沈んだ灰。飾り罫は置かない（余白で間を取る）。
    h("div", {
      key: "body",
      style: {
        fontSize: 21, lineHeight: 1.9, color: INK_LO,
        fontWeight: 400, display: "flex", marginTop: 30, maxWidth: 470,
      },
    }, body),
  ]),

  // タグ：極小・中黒区切り。左下隅へ。pill なし。
  h("div", {
    key: "tags",
    style: {
      position: "absolute",
      left: 96, bottom: 70,
      fontSize: 15, letterSpacing: 2, color: INK_LO,
      fontWeight: 400, display: "flex",
    },
  }, tagline),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_variant_minimal_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
