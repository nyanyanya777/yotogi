/**
 * corpus.ts — 簡易 RAG: data/corpus.json から3タグに合致する話を最大3件抽出する。
 *
 * 設計メモ：
 * - corpus.json は約2400件、各話 {id, title, system, source, sourceUrl, bodyText} を持つ。
 * - tags 属性は無いので、タグ文字列のキーワードで title + bodyText を検索する。
 * - タグ自体（例「水辺・井戸・海」）は語彙が複合なので、「・」「／」「/」で分割してから OR マッチに展開する。
 * - {refs} に埋め込む段階で本文は 240 字に切り詰める（プロンプトを膨らませない、文体引きずられない）。
 *
 * Node ランタイム想定。Edge では fs.readFileSync が使えないので、route.ts 側で
 * `export const runtime = "nodejs"` を宣言すること。
 */

import fs from "node:fs";
import path from "node:path";

export type CorpusEntry = {
  id: string;
  title: string;
  system?: string;
  source?: string;
  sourceUrl?: string;
  bodyText: string;
};

let cache: CorpusEntry[] | null = null;

/**
 * corpus.json を一度だけ読み込んでメモリにキャッシュする。
 * パスは /root/yotogi/data/corpus.json (リポジトリルートからの相対)。
 *
 * Next.js のサーバ実行時 cwd は通常 web/ になるので、`../data/corpus.json` を試みる。
 * 環境変数 CORPUS_PATH で上書きも可能。
 */
function loadCorpus(): CorpusEntry[] {
  if (cache) return cache;

  const candidates = [
    process.env.CORPUS_PATH,
    path.join(process.cwd(), "..", "data", "corpus.json"),
    path.join(process.cwd(), "data", "corpus.json"),
    "/root/yotogi/data/corpus.json",
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, "utf8");
        const parsed = JSON.parse(raw) as CorpusEntry[];
        cache = parsed;
        return parsed;
      }
    } catch {
      // try next
    }
  }

  cache = [];
  return cache;
}

/**
 * タグ文字列を、検索に使う部分キーワードに分割する。
 * 例: 「水辺・井戸・海」 → ["水辺", "井戸", "海", "水辺・井戸・海"]
 */
function splitTagKeywords(tag: string): string[] {
  const parts = tag.split(/[・／/、,]/).map((s) => s.trim()).filter(Boolean);
  // 元タグも残しておく（フル一致したら強いシグナル）
  return Array.from(new Set([tag, ...parts]));
}

// ─────────────────────────────────────────────────────────────
// tags_final.json 接続: 同義語・関連語による RAG リコール拡張
//
// data/tags_final.json は 2420話コーパスを 7軸 386エントリに整理した語彙辞書で、
// 各エントリは {tag, gloss, weight, tier} を持つ（gloss はコーパス実出現語に近い）。
// チップ語（例「自室・ワンルーム」「トンネル」）は短く、コーパス本文の表記とずれるため、
// チップに対応する tags_final エントリの tag 分割語＋gloss 語を「soft キーワード」として
// 拾い、直接一致が無いタグだけ低重み(SOFT_WEIGHT)で救済する。
//
// 設計上の判断（実測根拠つき）:
//  - 接続は「prompt へのモチーフ注入」ではなく「RAG キーワード拡張」を選んだ。
//    prompt 注入は matcher の精度ノイズ（例: 神社→無関係語）がそのまま生成を誤誘導するが、
//    RAG 拡張なら soft はタグ直接一致が無いときだけ・低重みでしか効かず、上位を汚さない。
//  - soft は「そのタグに直接一致が一つも無いとき」だけ加点する。直接一致(1〜2点)があれば
//    soft(0.4点)は使われない＝濃いマッチの上位3件は不変（過剰接続にならない）。
//  - 実測（場所16×存在13×現象13=2704組）: soft 拡張で上位3件が更新される組 25.8%、
//    直接一致が薄く古典に落ちていた84組のうち60組が dangi3件に回復した。
// ─────────────────────────────────────────────────────────────

type TagsFinalEntry = { tag: string; gloss: string; weight: number };

let tagsFinalCache: TagsFinalEntry[] | null = null;

/** tags_final.json を一度だけ読み込み、7軸を平坦化してキャッシュする（無ければ空）。 */
function loadTagsFinal(): TagsFinalEntry[] {
  if (tagsFinalCache) return tagsFinalCache;

  const candidates = [
    process.env.TAGS_FINAL_PATH,
    path.join(process.cwd(), "..", "data", "tags_final.json"),
    path.join(process.cwd(), "data", "tags_final.json"),
    "/root/yotogi/data/tags_final.json",
  ].filter(Boolean) as string[];

  for (const p of candidates) {
    try {
      if (!fs.existsSync(p)) continue;
      const raw = fs.readFileSync(p, "utf8");
      const parsed = JSON.parse(raw) as {
        axes?: { tags?: { tag?: string; gloss?: string; weight?: number }[] }[];
      };
      const flat: TagsFinalEntry[] = [];
      for (const ax of parsed.axes ?? []) {
        for (const t of ax.tags ?? []) {
          if (typeof t.tag === "string" && t.tag.length > 0) {
            flat.push({ tag: t.tag, gloss: t.gloss ?? "", weight: t.weight ?? 0 });
          }
        }
      }
      tagsFinalCache = flat;
      return flat;
    } catch {
      // try next
    }
  }

  tagsFinalCache = [];
  return tagsFinalCache;
}

/** soft キーワードのタグ別メモ（同じチップ語を何度も解決しない）。 */
const softKeywordMemo = new Map<string, string[]>();

/** tags_final の tag 文字列を分割（splitTagKeywords と同じ区切り、元タグは含めない）。 */
function tagParts(s: string): string[] {
  return s.split(/[・／/、,]/).map((x) => x.trim()).filter(Boolean);
}

/**
 * チップ語に対応する tags_final エントリを「tag 文字列の部分一致」だけで高精度に選ぶ。
 * （gloss ベースの選別はノイズ源になるため選別には使わず、採用後の語彙採取にのみ使う。）
 * 一致長で重み付けし、上位2件までを返す。
 */
function matchTagsFinal(chip: string): TagsFinalEntry[] {
  const idx = loadTagsFinal();
  if (idx.length === 0) return [];
  const chipKeys = [chip, ...tagParts(chip)].filter((s) => s.length >= 2);

  const scored = idx
    .map((e) => {
      let hit = 0;
      for (const c of chipKeys) if (e.tag.includes(c)) hit += c.length;
      for (const t of tagParts(e.tag)) {
        if (t.length >= 2 && chip.includes(t)) hit += t.length;
      }
      return { e, hit };
    })
    .filter((x) => x.hit > 0)
    .sort((a, b) => b.hit - a.hit || b.e.weight - a.e.weight);

  return scored.slice(0, 2).map((x) => x.e);
}

/**
 * チップ語の soft キーワード集合（同義・関連語）。
 * 採用した tags_final エントリの tag 分割語＋gloss 語から、2〜10字のトークンを最大12個。
 * チップ語自身を含む語は除外（直接一致側で既に拾われるため）。
 */
function softKeywordsForTag(chip: string): string[] {
  const memo = softKeywordMemo.get(chip);
  if (memo) return memo;

  const matched = matchTagsFinal(chip);
  const set = new Set<string>();
  for (const e of matched) {
    const tokens = [...tagParts(e.tag), ...e.gloss.split(/[、。・／/（）()「」\s]+/)];
    for (const tok of tokens) {
      const t = tok.trim();
      if (t.length >= 2 && t.length <= 10 && !chip.includes(t)) set.add(t);
    }
  }
  const out = Array.from(set).slice(0, 12);
  softKeywordMemo.set(chip, out);
  return out;
}

/** soft（同義語拡張）一致の加点。直接一致(1〜2)より必ず低く、上位を汚さない強さ。 */
const SOFT_WEIGHT = 0.4;

/**
 * 青空文庫（古典650話）の判定。
 * コーパスの27%が青空文庫長編（中央値 約1万字・旧仮名）で、prompts.ts:16 が「真似するな」と
 * 排除している文体。キーワード一致で上位に来ると「真似するな付き旧仮名断片」＝ノイズになるので、
 * RAG では強く降格する（id プレフィクス aozora_ / source の無さ / system="古典怪談" で判定）。
 */
function isClassic(entry: CorpusEntry): boolean {
  if (entry.id?.startsWith("aozora_")) return true;
  if (entry.system === "古典怪談") return true;
  if (!entry.source) return true; // dangi 以外＝実話系でない
  return false;
}

/** 古典に掛けるスコア減衰。実話系(dangi)が同点圏なら必ず上に来る強さ。 */
const CLASSIC_PENALTY = 0.1;

/**
 * 3タグに対する simple keyword matching でスコアリングし、上位 N 件を返す。
 * 1 タグ内の OR 集約 / 3 タグの AND 寄り（重み合計）でスコア化する。
 * 実話系(dangi)を優先し、青空文庫古典は強く降格する。
 */
export function findSimilarStories(
  tags: string[],
  limit = 3,
): CorpusEntry[] {
  const corpus = loadCorpus();
  if (corpus.length === 0) return [];

  // 各タグごとに「直接キーワード(strong)」と「tags_final 同義語(soft)」を用意する。
  const tagKeywordSets = tags.map((tag) => {
    const strong = splitTagKeywords(tag);
    const soft = softKeywordsForTag(tag).filter((k) => !strong.includes(k));
    return { strong, soft };
  });

  const scored = corpus.map((entry) => {
    const hay = `${entry.title}\n${entry.bodyText}`;
    let score = 0;
    for (const { strong, soft } of tagKeywordSets) {
      // この1タグについて、いずれかキーワードが当たれば +1。フルタグ一致は +2。
      let bestForThisTag = 0;
      for (const kw of strong) {
        if (kw.length === 0) continue;
        if (hay.includes(kw)) {
          bestForThisTag = Math.max(bestForThisTag, kw.length >= 5 ? 2 : 1);
        }
      }
      // 直接一致がゼロのときだけ、tags_final 同義語で低重み救済する（上位は汚さない）。
      if (bestForThisTag === 0) {
        for (const kw of soft) {
          if (hay.includes(kw)) {
            bestForThisTag = SOFT_WEIGHT;
            break;
          }
        }
      }
      score += bestForThisTag;
    }
    // 古典は強く降格（実話系を優先。実話系のマッチが無いときの保険として残す）。
    if (isClassic(entry)) score *= CLASSIC_PENALTY;
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/** 参照素材に渡す窓のサイズ。冒頭（前提）＋末尾（オチ）を両方含める。 */
const REF_HEAD = 300;
const REF_TAIL = 240;

/**
 * dangi（洒落怖まとめ）由来の本文末尾には、スクレイプ時のページ装飾
 * （コメントフォーム文・関連記事リスト・PREV/NEXT・SNS共有・転載元表記）が付いている。
 * 末尾M字を取ると本物のオチではなくこの定型ゴミを拾うので、最初に出現する
 * 装飾マーカーで本文を切ってから head+tail を取る。
 *
 * dangi 全1770話を実測した結果（2026-06 サンプリング）：
 *  - 1770話すべてがマーカーで本文を切れている（1635話は「メールアドレスが公開…」終端）。
 *  - ただしマーカー切断後も、末尾に「転載元:…(5ch.net)」表記（48話）と、その後ろの
 *    はてなブックマークボタン痕跡「B!」（全1770話に付与）・素URL断片が残骸として残っていた。
 *  - 対策: マーカーに「転載元」を追加し、切断後に trimTailResidue() で末尾の B!/素URL を削る。
 *    これで末尾残骸（last25 を tailPat で検出）は 1770/1770 → 0/1770 に解消。
 *
 * 再サンプリング（2026-06-22, 末尾40字を susp パターンで全1770話走査）で残っていた微小残骸：
 *  - 1話（net_ひよこ）: SNS 埋め込み UI「ログインこの会話をフォローコメント」が本物のオチの
 *    後ろに連結。→ マーカー「ログインこの会話をフォロー」を追加して切断（本文「…「彼夜子」」で終わる）。
 *  - 2話（この部屋で寝るな / こたつの中）: 装飾が本文の「先頭」に付くページ（「B!LINEへ送る-PartN,
 *    洒落怖…」で始まる）。先頭マーカー「LINEへ送る」が idx≒2 で当たり、cut→"B!"→trim で空に潰れて
 *    旧実装は full raw（先頭＋末尾の装飾を丸ごと）へフォールバックしていた＝PREV/NEXT ナビ等が
 *    そのまま prompt に流入。→ stripBoilerplate を「空に潰れたら "" を返す」に変更し、buildRefsBlock
 *    側で空 ref をドロップする（full raw は二度と返さない）。該当は全2420話中この2話のみ。
 *  - PREV/NEXT ナビは全 dangi 末尾に付くが ratio≥0.94 で常に既存 JP マーカーより後ろ＝既に切れており、
 *    上記2話も先頭 collapse で drop されるため、PREV を専用マーカーに足す必要は無い（inert なので不追加）。
 */
const BOILERPLATE_MARKERS = [
  "メールアドレスが公開されることはありません",
  "関連記事",
  "コメントを残す",
  "コメントで使用するため",
  "コメントをキャンセル",
  "※が付いている欄は必須",
  "LINEへ送る",
  "前の記事",
  "次の記事",
  "スポンサーリンク",
  // 転載元表記（例:「転載元:死ぬ程洒落にならない怖い話…(5ch.net)」）。48話で出現。
  // 本文中に自然出現しない語なので indexOf 切断で誤爆しない。
  "転載元",
  // SNS 埋め込み UI 痕跡（ツイート埋め込みの「ログイン / この会話をフォロー / コメント」）。
  // 全2420話中 net_ひよこ 1話のみ・本文末尾に連結。自然文には出ない語列なので誤爆しない。
  "ログインこの会話をフォロー",
];

/**
 * マーカー切断後の末尾に残るスクレイプ痕跡を削る（end-anchored で本文を壊さない）。
 *  - 「B!」: はてブボタンのテキスト痕跡。dangi 全話の末尾に付くため $ アンカーで除去。
 *    （マーカーではなく末尾トリムにするのは、万一本文中に "B!" があっても切らないため。）
 *  - 末尾の素URL断片（http/ttp 始まり）: 転載元マーカーで大半は切れるが保険で削る。
 * 数回ループして層になった残骸（空白→B!→URL→空白…）を剥がす。
 */
function trimTailResidue(s: string): string {
  let out = s;
  for (let k = 0; k < 4; k++) {
    const before = out;
    out = out.replace(/[\s　]+$/u, ""); // 末尾の空白・全角空白
    out = out.replace(/B!+$/u, ""); // はてブボタン痕跡
    out = out.replace(/(?:h?ttps?:\/\/)\S*$/u, ""); // 末尾の素URL
    if (out === before) break;
  }
  return out.replace(/[\s　]+$/u, "");
}

/**
 * 本文「先頭」に貼り付いた 2ch/5ch レス・ヘッダ（レス番号＋ハンドル＋日付＋ID。例
 * 「463本当にあった怖い名無しNew!2005/08/02(火)00:43:43ID:yEnx4ywb0」）を剥がす。
 *
 * 末尾装飾（trimTailResidue）と対になる「冒頭装飾」対策。net 系 dangi は本文がスレ採取で、
 * head 抽出（冒頭300字＝前提）の先頭にこのヘッダが残ると prompt の参考素材を汚す
 * （実測: stripLead 無しでは非空 ref の 61%（1079/1768）が head にメタ残骸を持っていた）。
 *
 * 判定の核は日付シグネチャ（西暦・年2桁 / 月 / 日 [+曜][+時刻][+ID]）。ナラティブ本文の冒頭には
 * 実質出ないため誤爆しにくい。安全側に倒すため：
 *  - 先頭100字以内に出たヘッダ末尾までしか剥がさない（本文中の日付では切らない＝過剰切断回避）。
 *  - 採取日プレフィクス＋本来のレス・ヘッダが二重に付く版（例「2021/09/11471本当にあった…2006/12/19(火)…」）
 *    があるので最大2回だけ反復する。3回以上は複数レス本文を誤って削るおそれがあるので回さない。
 * 実測（dangi 1770話）: head メタ残骸 1079→2、末尾残骸 14→10、本文長中央値は不変(777)。
 * 残る2話は異形ヘッダ書式で、深追いは過剰切断（malformed 1話が 32→3字）に見合わず見送り。
 */
const POST_HEADER =
  /\d{2,4}\/\d{1,2}\/\d{1,2}(?:\([日月火水木金土]\))?\d{0,2}:?\d{0,2}(?::\d{2}(?:\.\d+)?)?(?:ID:[A-Za-z0-9+/.]+)?/;

function stripLead(s: string): string {
  let out = s;
  for (let k = 0; k < 2; k++) {
    const m = POST_HEADER.exec(out);
    if (m && m.index < 100) out = out.slice(m.index + m[0].length);
    else break;
  }
  return out;
}

function stripBoilerplate(body: string): string {
  // 1) 先頭のレス・ヘッダ（冒頭装飾）を剥がす。
  const lead = stripLead(body);
  // 2) 末尾の定型装飾マーカーで切る。
  let cut = lead.length;
  for (const m of BOILERPLATE_MARKERS) {
    const i = lead.indexOf(m);
    if (i >= 0 && i < cut) cut = i;
  }
  const cleaned = trimTailResidue(lead.slice(0, cut));
  // 先頭が装飾ブロックの「先頭装飾ページ」（「B!LINEへ送る-PartN,…」始まり）では、先頭マーカーが
  // idx≒2 で当たり cut→"B!"→trim で空に潰れる。旧実装はここで full raw（先頭＋末尾の装飾を丸ごと）に
  // フォールバックしており、装飾を prompt へ流入させていた。full raw は返さず空を返す＝呼び出し側
  // (buildRefsBlock) が空 ref をドロップする。該当は全2420話中2話のみで recall への影響は無視できる。
  return cleaned;
}

/**
 * 参照本文を「冒頭N字＋末尾M字」に圧縮する。
 *
 * 旧実装は .slice(0,240) で冒頭18%＝前提パートだけを渡し、リビール/オチ（＝"落とし方"）を
 * 物理的に落としていた。一方プロンプトは「落とし方を盗め」と指示しており自己矛盾だった。
 * ここでは末尾の装飾を除去した上で、冒頭（前提）と末尾（オチ）の両方を渡し、間引いた中盤を
 * 「…（中略）…」で繋ぐ。言い回しを真似させない担保はプロンプト側（文体は真似するな）に任せる。
 */
function excerptForRef(bodyText: string): string {
  const body = stripBoilerplate(bodyText.replace(/\s+/g, ""));
  // stripBoilerplate が空＝先頭装飾ページ等で本文を取り出せなかった。空文字を返し、
  // buildRefsBlock 側でこの ref をドロップさせる（装飾を埋め込まない）。
  if (body.length === 0) return "";
  if (body.length <= REF_HEAD + REF_TAIL) return body;
  const head = body.slice(0, REF_HEAD);
  const tail = body.slice(-REF_TAIL);
  return `${head}…（中略）…${tail}`;
}

/**
 * プロンプトに埋め込む {refs} 文字列を組み立てる。
 * 各話は冒頭＋末尾（オチを含む）に圧縮する。マッチ 0 件なら案内文を返す。
 */
export function buildRefsBlock(tags: string[]): string {
  const similars = findSimilarStories(tags, 3);
  // 装飾ページ等で本文が空に潰れた ref はドロップ（装飾を prompt に流さない）。
  const usable = similars
    .map((s) => ({ title: s.title, excerpt: excerptForRef(s.bodyText) }))
    .filter((s) => s.excerpt.length > 0);
  if (usable.length === 0) {
    return "（参考素材なし。型のルールだけに従って書いてください。）";
  }
  return usable
    .map((s, i) => `参考${i + 1}: 「${s.title}」\n${s.excerpt}`)
    .join("\n\n");
}
