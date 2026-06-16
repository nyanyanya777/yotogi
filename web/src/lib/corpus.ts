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

/**
 * 3タグに対する simple keyword matching でスコアリングし、上位 N 件を返す。
 * 1 タグ内の OR 集約 / 3 タグの AND 寄り（重み合計）でスコア化する。
 */
export function findSimilarStories(
  tags: string[],
  limit = 3,
): CorpusEntry[] {
  const corpus = loadCorpus();
  if (corpus.length === 0) return [];

  const tagKeywordSets = tags.map(splitTagKeywords);

  const scored = corpus.map((entry) => {
    const hay = `${entry.title}\n${entry.bodyText}`;
    let score = 0;
    for (const keywords of tagKeywordSets) {
      // この1タグについて、いずれかキーワードが当たれば +1。フルタグ一致は +2。
      let bestForThisTag = 0;
      for (const kw of keywords) {
        if (kw.length === 0) continue;
        if (hay.includes(kw)) {
          bestForThisTag = Math.max(bestForThisTag, kw.length >= 5 ? 2 : 1);
        }
      }
      score += bestForThisTag;
    }
    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.entry);
}

/**
 * プロンプトに埋め込む {refs} 文字列を組み立てる。
 * 各話は 240 字に切り詰める（文体引きずられ防止）。マッチ 0 件なら空文字列を返す。
 */
export function buildRefsBlock(tags: string[]): string {
  const similars = findSimilarStories(tags, 3);
  if (similars.length === 0) {
    return "（参考素材なし。型のルールだけに従って書いてください。）";
  }
  return similars
    .map((s, i) => {
      const body = s.bodyText.replace(/\s+/g, "").slice(0, 240);
      return `参考${i + 1}: 「${s.title}」\n${body}…`;
    })
    .join("\n\n");
}
