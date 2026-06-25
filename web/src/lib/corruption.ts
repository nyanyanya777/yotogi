/**
 * corruption.ts — ネットロアの「呪い」演出。生成物がごく稀に壊れる。
 *
 * - 怪談(本文/タイトル): 約 1/10 で全文が文字化け、または無意味な単語の羅列になる。
 * - モチーフタグ      : 約 1/10 で 16 個のうち 1 つのラベルが文字化けする。
 *
 * 文字化けは UTF-8 を Shift_JIS / Latin-1 として読んだ風の CJK 断片で、本物の
 * mojibake に寄せる。判定は Math.random（決定論にしない＝毎回違う場所が壊れるのが不気味）。
 * SSR と差異が出るため、必ずクライアント側(useEffect / イベントハンドラ)から呼ぶこと。
 */

import type { StoredStory } from "./yotogiStorage";

/** 怪談が壊れる確率。 */
export const STORY_CORRUPT_RATE = 0.1;
/** タグが 1 つ壊れる確率。 */
export const TAG_CORRUPT_RATE = 0.1;

// UTF-8 を別エンコーディングで読んだ風の壊れ文字プール。
const MOJIBAKE =
  "縺繧繝蟆蟶蟄譁蜉髢豢郢繹隲蝣繚郤ｽｦｰｸｿﾂ�□◆◇▩▒░".split("");

// 無意味な羅列に使う実在語（互いに無関係＝意味を成さない）。
const SALAD =
  "椅子 窓 三日 鏡 階段 そして けれど 水 名前 指 沈黙 廊下 知らない 笑った 番号 だから 影 髪 のに 母 八 つめたい 戸 顔 後ろ 声 数 増える"
    .split(" ");

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** src と同じ長さ・改行構造のまま、非空白を壊れ文字に置き換える。 */
function mojibakeLike(src: string): string {
  let out = "";
  for (const ch of src) {
    out += /\s/.test(ch) ? ch : pick(MOJIBAKE);
  }
  return out;
}

/** およそ approxChars 文字ぶん、無関係な語を並べた羅列を作る。 */
function wordSalad(approxChars: number): string {
  const target = Math.max(6, approxChars);
  let out = "";
  while (out.length < target) {
    out += pick(SALAD);
    if (out.length < target && Math.random() < 0.5) out += " ";
  }
  return out;
}

/** 怪談を確定的に壊す（全文文字化け or 無意味な単語の羅列）。 */
export function corruptStory(s: StoredStory): StoredStory {
  if (Math.random() < 0.5) {
    // 全文文字化け
    return { title: mojibakeLike(s.title), body: mojibakeLike(s.body) };
  }
  // 無意味な単語の羅列（段落構造は残す）
  const paras = s.body.split(/\n{2,}/);
  const body = paras.map((p) => wordSalad(p.length)).join("\n\n");
  return { title: wordSalad(Math.min(s.title.length, 18)), body };
}

/** 約 STORY_CORRUPT_RATE の確率で怪談を壊す。それ以外はそのまま返す。 */
export function maybeCorruptStory(s: StoredStory): StoredStory {
  return Math.random() < STORY_CORRUPT_RATE ? corruptStory(s) : s;
}

/**
 * タグの文字化けマップ。約 TAG_CORRUPT_RATE の確率で labels の 1 つを選び
 * 「元ラベル → 文字化けラベル」の 1 件マップを返す。壊れない場合は空 {}。
 * 表示・選択値・履歴すべてこの壊れたラベルに一貫させる（＝呪いが伝播する）。
 */
export function maybeCorruptTagMap(labels: string[]): Record<string, string> {
  if (labels.length === 0 || Math.random() >= TAG_CORRUPT_RATE) return {};
  const orig = pick(labels);
  return { [orig]: mojibakeLike(orig) };
}
