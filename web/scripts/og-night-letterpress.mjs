// og-night-letterpress.mjs — 「夜の活版」: letterpress(活版怪談本)の版面構造を
//   そのまま維持し、明度モードだけ 昼(焼け紙) → 夜(墨黒) に反転した OG 試作。
// 思想: letterpress の AI感ゼロの正体は「色」ではなく「人が組んだ版面構造」なので、
//        匡郭/柱/ノンブル/非対称二行積み/界線/欄外注記/簾の目 は一切触らず、配色のみ反転する。
// 本番ルートと og-sample.mjs と og-variant-letterpress.mjs は改変しない(複製して作成)。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- 配色: 墨黒の地 + 退色した骨白/銀インク + 一点の朱(実UIの朱 #D91C0B) ---
const PAPER = "#0B0B0B"; // 墨黒(実プロダクト UI の sumi-0 と同色)
const INK   = "#E7E1D8"; // タイトル/主インク = 退色した骨白(黒地に乗る高めの明度)
const INK2  = "#8C8377"; // 本文インク = 沈んだ銀(中コントラスト)
const FAINT = "#6C6149"; // 欄外・柱の薄インク = さらに沈んだ銀
const RED   = "#D91C0B"; // 朱(実 UI の朱)。版面に一度だけ最小限。
const LINE  = "#5A554C"; // 匡郭・界線の細罫 = 沈んだ銀

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

// --- 固定サンプル怪談(letterpress と同一) ---
const T1 = "深夜の";
const T2 = "エレベーター";
const BODY = "四階で止まるはずのない箱が、止まった。";
const HEAD_L = "實話怪談 二〇二六";
const HEAD_R = "― 〇三四 ―";
const KICKER = "―― 其ノ参 ――";
const CAP1 = "投稿 〇三四";
const CAP2 = "語り 匿名";
const STAMP = "夜伽文庫";
const FOOT_L = "實話怪談 ・ エレベーター";
const TAGLINE = "ネットロア叢書";
const BRAND = "YOTOGI";

// 描画する全文字をサブセットに必ず含める(漏れ=豆腐)
const boldTexts = [T1, T2];
const regularTexts = [HEAD_L, HEAD_R, KICKER, BODY, CAP1, CAP2, STAMP, FOOT_L, TAGLINE];
const sansTexts = [BRAND];

const [serifBold, serifReg, sansBrand] = await Promise.all([
  loadSubset("Noto Serif JP", boldTexts, 700),
  loadSubset("Noto Serif JP", regularTexts, 400),
  loadSubset("Noto Sans JP", sansTexts, 700),
]);

const fonts = [];
if (serifBold) fonts.push({ name: "Noto Serif JP", data: serifBold, weight: 700, style: "normal" });
if (serifReg)  fonts.push({ name: "Noto Serif JP", data: serifReg,  weight: 400, style: "normal" });
if (sansBrand) fonts.push({ name: "Noto Sans JP",  data: sansBrand, weight: 700, style: "normal" });
console.log("fonts loaded:", { serifBold: !!serifBold, serifReg: !!serifReg, sansBrand: !!sansBrand });

const serif = '"Noto Serif JP", "Hiragino Mincho ProN", "Yu Mincho", serif';
const sans  = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", sans-serif';

// 夜の地のテクスチャ: 隅のごく淡い陰影(活版の凹凸が夜に沈む) + 朱のにじみを一点 +
//   簾の目(laid lines)を極薄い銀で。黒地で白く光らせない=明度は終始低く。
const paperBg = [
  "linear-gradient(135deg, rgba(231,225,216,0.05) 0%, rgba(231,225,216,0) 26%)",
  "linear-gradient(315deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0) 32%)",
  "radial-gradient(150% 130% at 16% 86%, rgba(217,28,11,0.07) 0%, rgba(217,28,11,0) 40%)",
  "repeating-linear-gradient(90deg, rgba(231,225,216,0.035) 0px, rgba(231,225,216,0.035) 1px, rgba(231,225,216,0) 1px, rgba(231,225,216,0) 4px)",
].join(", ");

const rule = (extra = {}) => h("div", { style: { display: "flex", height: 1, background: LINE, ...extra } });

const tree = h("div", {
  style: {
    width: "100%", height: "100%", display: "flex", padding: 0,
    backgroundColor: PAPER, backgroundImage: paperBg,
    fontFamily: serif, color: INK,
  },
}, [
  // 匡郭(双辺): 外枠 + 内枠 の二重罫(沈んだ銀)
  h("div", {
    key: "frame",
    style: {
      display: "flex", flexDirection: "column", flexGrow: 1,
      margin: 34, padding: 6, border: `1.5px solid ${LINE}`,
    },
  }, [
    h("div", {
      key: "block",
      style: {
        display: "flex", flexDirection: "column", flexGrow: 1,
        border: `1px solid ${LINE}`, padding: "30px 52px",
        justifyContent: "space-between",
      },
    }, [
      // ── 柱(はしら)+ ノンブル ─────────────────────────────
      h("div", { key: "head", style: { display: "flex", flexDirection: "column" } }, [
        h("div", {
          key: "headrow",
          style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
        }, [
          h("div", { key: "hl", style: { display: "flex", fontSize: 22, letterSpacing: 8, color: FAINT } }, HEAD_L),
          h("div", { key: "hr", style: { display: "flex", fontSize: 22, letterSpacing: 6, color: FAINT } }, HEAD_R),
        ]),
        rule({ marginTop: 14, background: FAINT, height: 1 }),
      ]),

      // ── 版面の本体: 左に大見出し(重心を左下へ)/ 右に細い界線と欄外注記 ──
      h("div", {
        key: "main",
        style: { display: "flex", flexDirection: "row", flexGrow: 1, alignItems: "stretch", paddingTop: 16 },
      }, [
        // 左カラム: 見出しを下端へ寄せる(非対称・引き)
        h("div", {
          key: "left",
          style: { display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "flex-end", paddingRight: 40 },
        }, [
          // 通し番号(小)+ 標(夜は朱を増やさない=沈んだ銀の小角)
          h("div", { key: "kick", style: { display: "flex", alignItems: "center", marginBottom: 18 } }, [
            h("div", { key: "kmark", style: { display: "flex", width: 14, height: 14, background: FAINT, marginRight: 16 } }),
            h("div", { key: "ktxt", style: { display: "flex", fontSize: 24, letterSpacing: 10, color: FAINT } }, KICKER),
          ]),
          // 大見出し: 二行積み・左寄せ・二行目を字下げ
          h("div", { key: "t1", style: { display: "flex", fontSize: 90, fontWeight: 700, lineHeight: 1.08, color: INK } }, T1),
          h("div", { key: "t2", style: { display: "flex", fontSize: 90, fontWeight: 700, lineHeight: 1.08, color: INK, paddingLeft: 66 } }, T2),
          // 朱の短い罫(中央寄せの飾り罫ではなく左端起点)
          rule({ width: 132, height: 3, background: RED, marginTop: 26 }),
          // 本文の"引き": 退色インクで一段組
          h("div", {
            key: "body",
            style: { display: "flex", maxWidth: 760, fontSize: 30, lineHeight: 1.95, color: INK2, marginTop: 22, whiteSpace: "nowrap" },
          }, BODY),
        ]),

        // 界線(版心の罫)
        h("div", { key: "gut", style: { display: "flex", width: 1, alignSelf: "stretch", background: LINE } }),

        // 右カラム: 欄外の小活字(右寄せ・密)。重心の偏りを支える。
        h("div", {
          key: "right",
          style: {
            display: "flex", flexDirection: "column", width: 196,
            justifyContent: "space-between", alignItems: "flex-end",
            paddingLeft: 28, paddingTop: 6, paddingBottom: 6,
          },
        }, [
          h("div", { key: "rtop", style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } }, [
            h("div", { key: "rbar", style: { display: "flex", width: 4, height: 44, background: LINE, marginBottom: 22 } }),
            h("div", { key: "c1", style: { display: "flex", fontSize: 22, letterSpacing: 4, color: FAINT, marginBottom: 10 } }, CAP1),
            h("div", { key: "c2", style: { display: "flex", fontSize: 22, letterSpacing: 4, color: FAINT } }, CAP2),
          ]),
          // 蔵書印めいた小箱(奥付スタンプ)
          h("div", {
            key: "stamp",
            style: { display: "flex", fontSize: 20, letterSpacing: 6, color: INK, border: `1px solid ${LINE}`, padding: "8px 14px" },
          }, STAMP),
        ]),
      ]),

      // ── 欄外フッタ: タグ=中黒区切りの小活字 / 右にブランド(角ゴで奥付風) ──
      h("div", { key: "foot", style: { display: "flex", flexDirection: "column" } }, [
        rule({ marginBottom: 16, background: FAINT, height: 1 }),
        h("div", {
          key: "footrow",
          style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
        }, [
          h("div", { key: "tags", style: { display: "flex", alignItems: "center" } }, [
            h("div", { key: "tbar", style: { display: "flex", width: 22, height: 2, background: FAINT, marginRight: 16 } }),
            h("div", { key: "ttxt", style: { display: "flex", fontSize: 24, letterSpacing: 3, color: INK2 } }, FOOT_L),
          ]),
          h("div", { key: "brand", style: { display: "flex", alignItems: "baseline" } }, [
            h("div", { key: "bw", style: { display: "flex", fontFamily: sans, fontWeight: 700, fontSize: 30, letterSpacing: 10, color: INK } }, BRAND),
            h("div", { key: "bt", style: { display: "flex", fontSize: 19, letterSpacing: 4, color: FAINT, marginLeft: 16 } }, TAGLINE),
          ]),
        ]),
      ]),
    ]),
  ]),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_variant_night_letterpress_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
