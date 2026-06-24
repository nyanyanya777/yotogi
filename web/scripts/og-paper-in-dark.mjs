// og-paper-in-dark.mjs — 「闇の中の紙片」方向の OG 試作。
// 本番ルート・og-sample.mjs・og-variant-letterpress.mjs は改変しない(独立スクリプト)。
//
// 失敗した夜版(letterpressを色反転して匡郭と罫だけ黒地に残した版)の反省:
//   letterpressの魂は「版面構造」ではなく「紙そのもの(焼け紙の地・インクの乗り・
//   二色刷の温度・簾の目)」というメディアにあった。色反転で紙を剥がしたら
//   ダークモードの証明書テンプレになった。→ 今回は色反転しない。
//
// 方針: 焼け紙の letterpress カードを"温かい紙面のまま"保持し、それを
//   「暗闇に置かれた一枚の印刷物(物体)」として見せる。全体は near-black の暗がり。
//   中央の紙だけは紙の質感と温度を完全に維持。ドロップシャドウ・縁の焼け・
//   暗い余白(マット)で物体感を出す。タイムライン(ダーク)で一枚だけ白く光らない。
import { ImageResponse } from "next/og.js";
import { createElement as h } from "react";
import { writeFileSync } from "node:fs";

// --- 紙面の配色(letterpressのまま・色反転しない) ---
const PAPER = "#E2D7BE"; // 焼けたボーン紙
const INK   = "#1B1812"; // 温かい墨(純黒を避ける)
const INK2  = "#3A332A"; // 本文インク(やや退色)
const FAINT = "#6C6149"; // 欄外・柱の薄インク
const RED   = "#8A1A11"; // 赤錆/血。版面に一度だけ。
// --- 暗闇の配色(紙を置く場) ---
const DARK  = "#08080A"; // near-black の暗がり

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

// --- 固定サンプル怪談(既存 letterpress と同一) ---
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

// 紙のテクスチャ(letterpressの地のまま): 簾の目(laid lines) + 隅のシミ + 既存の影。
// さらに紙端を暗がりへ落とすヴィネット(=物体化: 紙の四辺が闇へフェードする)。やりすぎない。
const paperBg = [
  // 紙端→闇のフェード(物体感の核。中央〜72%は紙の温度を完全保持、隅だけ薄く翳る)
  // フェードは冷たい青黒でなく焼けた茶黒(=紙の温度を保ったまま影へ沈む)
  "radial-gradient(138% 138% at 50% 44%, rgba(30,20,10,0) 72%, rgba(26,17,9,0.06) 86%, rgba(20,13,7,0.26) 100%)",
  // 光源の方向感: 上から柔らかく当たり、下隅へ落ちる
  "linear-gradient(160deg, rgba(255,246,220,0.12) 0%, rgba(255,246,220,0) 28%)",
  // 隅のシミ(不穏)
  "radial-gradient(150% 130% at 16% 86%, rgba(120,22,12,0.10) 0%, rgba(120,22,12,0) 38%)",
  // 既存の暖色の影
  "linear-gradient(135deg, rgba(20,15,10,0.16) 0%, rgba(20,15,10,0) 24%)",
  // 簾の目(laid lines)
  "repeating-linear-gradient(90deg, rgba(40,30,18,0.05) 0px, rgba(40,30,18,0.05) 1px, rgba(40,30,18,0) 1px, rgba(40,30,18,0) 4px)",
].join(", ");

// 暗闇の場: near-black に、紙の背後だけ温かい光だまり(光源)。隅は深い影で落とす。
const darkBg = [
  // 紙の背後の温かい光だまり(物体が照らされている表現)
  "radial-gradient(64% 76% at 50% 46%, rgba(86,64,34,0.32) 0%, rgba(80,60,32,0.09) 44%, rgba(8,8,10,0) 72%)",
  // 周辺=深い影(四隅を落とす)
  "radial-gradient(118% 118% at 50% 50%, rgba(0,0,0,0) 46%, rgba(0,0,0,0.7) 100%)",
].join(", ");

const rule = (extra = {}) => h("div", { style: { display: "flex", height: 1, background: INK, ...extra } });

// 紙の中身(=既存 letterpress の版面をそのまま)。匡郭(双辺)+柱/ノンブル+左下重心の見出し+右の界線。
const frame = h("div", {
  key: "frame",
  style: {
    display: "flex", flexDirection: "column", flexGrow: 1,
    margin: 22, padding: 6, border: `1.5px solid ${INK}`,
  },
}, [
  h("div", {
    key: "block",
    style: {
      display: "flex", flexDirection: "column", flexGrow: 1,
      border: `1px solid ${INK}`, padding: "26px 48px",
      justifyContent: "space-between",
    },
  }, [
    // ── 柱(はしら)+ ノンブル ─────────────────────────────
    h("div", { key: "head", style: { display: "flex", flexDirection: "column" } }, [
      h("div", {
        key: "headrow",
        style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
      }, [
        h("div", { key: "hl", style: { display: "flex", fontSize: 21, letterSpacing: 8, color: FAINT } }, HEAD_L),
        h("div", { key: "hr", style: { display: "flex", fontSize: 21, letterSpacing: 6, color: FAINT } }, HEAD_R),
      ]),
      rule({ marginTop: 13, background: FAINT, height: 1 }),
    ]),

    // ── 版面の本体: 左に大見出し(重心を左下へ)/ 右に細い界線と欄外注記 ──
    h("div", {
      key: "main",
      style: { display: "flex", flexDirection: "row", flexGrow: 1, alignItems: "stretch", paddingTop: 14 },
    }, [
      // 左カラム: 見出しを下端へ寄せる(非対称・引き)
      h("div", {
        key: "left",
        style: { display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "flex-end", paddingRight: 38 },
      }, [
        // 通し番号(小)+ 赤い標
        h("div", { key: "kick", style: { display: "flex", alignItems: "center", marginBottom: 16 } }, [
          h("div", { key: "kmark", style: { display: "flex", width: 13, height: 13, background: RED, marginRight: 15 } }),
          h("div", { key: "ktxt", style: { display: "flex", fontSize: 22, letterSpacing: 10, color: FAINT } }, KICKER),
        ]),
        // 大見出し: 二行積み・左寄せ・二行目を字下げ
        h("div", { key: "t1", style: { display: "flex", fontSize: 82, fontWeight: 700, lineHeight: 1.08, color: INK } }, T1),
        h("div", { key: "t2", style: { display: "flex", fontSize: 82, fontWeight: 700, lineHeight: 1.08, color: INK, paddingLeft: 60 } }, T2),
        // 赤の短い罫(中央寄せの飾り罫ではなく左端起点)
        rule({ width: 124, height: 3, background: RED, marginTop: 24 }),
        // 本文の"引き": 退色インクで一段組(1行で完結)
        h("div", {
          key: "body",
          style: { display: "flex", maxWidth: 760, fontSize: 28, lineHeight: 1.9, color: INK2, marginTop: 20, whiteSpace: "nowrap" },
        }, BODY),
      ]),

      // 界線(版心の罫)
      h("div", { key: "gut", style: { display: "flex", width: 1, alignSelf: "stretch", background: INK } }),

      // 右カラム: 欄外の小活字(右寄せ・密)。重心の偏りを支える。
      h("div", {
        key: "right",
        style: {
          display: "flex", flexDirection: "column", width: 184,
          justifyContent: "space-between", alignItems: "flex-end",
          paddingLeft: 26, paddingTop: 6, paddingBottom: 6,
        },
      }, [
        h("div", { key: "rtop", style: { display: "flex", flexDirection: "column", alignItems: "flex-end" } }, [
          h("div", { key: "rbar", style: { display: "flex", width: 4, height: 42, background: RED, marginBottom: 20 } }),
          h("div", { key: "c1", style: { display: "flex", fontSize: 21, letterSpacing: 4, color: FAINT, marginBottom: 9 } }, CAP1),
          h("div", { key: "c2", style: { display: "flex", fontSize: 21, letterSpacing: 4, color: FAINT } }, CAP2),
        ]),
        // 蔵書印めいた小箱(奥付スタンプ)
        h("div", {
          key: "stamp",
          style: { display: "flex", fontSize: 19, letterSpacing: 6, color: INK, border: `1px solid ${INK}`, padding: "7px 13px" },
        }, STAMP),
      ]),
    ]),

    // ── 欄外フッタ: タグ=中黒区切りの小活字 / 右にブランド(角ゴで奥付風) ──
    h("div", { key: "foot", style: { display: "flex", flexDirection: "column" } }, [
      rule({ marginBottom: 15, background: FAINT, height: 1 }),
      h("div", {
        key: "footrow",
        style: { display: "flex", justifyContent: "space-between", alignItems: "flex-end" },
      }, [
        h("div", { key: "tags", style: { display: "flex", alignItems: "center" } }, [
          h("div", { key: "tbar", style: { display: "flex", width: 22, height: 2, background: RED, marginRight: 15 } }),
          h("div", { key: "ttxt", style: { display: "flex", fontSize: 23, letterSpacing: 3, color: INK } }, FOOT_L),
        ]),
        h("div", { key: "brand", style: { display: "flex", alignItems: "baseline" } }, [
          h("div", { key: "bw", style: { display: "flex", fontFamily: sans, fontWeight: 700, fontSize: 29, letterSpacing: 10, color: INK } }, BRAND),
          h("div", { key: "bt", style: { display: "flex", fontSize: 18, letterSpacing: 4, color: FAINT, marginLeft: 15 } }, TAGLINE),
        ]),
      ]),
    ]),
  ]),
]);

// 暗闇の場 → 中央に紙片(物体)を一枚置く。四辺に暗い余白(マット)を残す。
const tree = h("div", {
  style: {
    width: "100%", height: "100%", display: "flex",
    alignItems: "center", justifyContent: "center",
    backgroundColor: DARK, backgroundImage: darkBg,
    fontFamily: serif, color: INK,
  },
}, [
  // 紙片(物体): 焼け紙のカード。ドロップシャドウで闇から浮かせ、縁は闇へフェード。
  h("div", {
    key: "paper",
    style: {
      display: "flex", flexDirection: "column",
      width: 972, height: 500,
      backgroundColor: PAPER, backgroundImage: paperBg,
      boxShadow: "0 36px 90px rgba(0,0,0,0.72), 0 12px 30px rgba(0,0,0,0.6)",
      // 紙端のわずかな焼け(暗がりへの薄い縁取り)
      border: "1px solid rgba(8,8,10,0.35)",
    },
  }, [frame]),
]);

const resp = new ImageResponse(tree, {
  width: 1200, height: 630,
  fonts: fonts.length > 0 ? fonts : undefined,
});

const buf = Buffer.from(await resp.arrayBuffer());
const out = "/Users/kohei/.openclaw/workspace/yotogi_variant_paper_in_dark_2026-06-22.png";
writeFileSync(out, buf);
console.log("WROTE", out, buf.length, "bytes");
