/**
 * recentSteers.ts — サーバ側の「直近に選んだ型メタ」の短命リング。
 *
 * 背景:
 *   連続同型（声/リビール/オチが続けて被る）の回避は、これまで完全にクライアント送信の
 *   history 頼みで、サーバはステートレスだった。クライアントが history を送らない初回や、
 *   別タブ・別端末からの連打では被り回避が効かない。
 *
 * 方針（過大設計を避ける軽量ローテ）:
 *   - プロセス内メモリにリングバッファで直近 N 件の StorySteerMeta を保持するだけ。
 *   - selectStorySteer の avoid に「クライアント history ∪ サーバ直近」を渡す補助に使う。
 *   - TTL（既定90秒）を超えた古いメタは捨てる＝あくまで“連続”同型の回避に限定する。
 *
 * 限界（正直な明記）:
 *   - サーバレス/マルチインスタンス（Vercel 等）ではインスタンス毎に別メモリで、全リクエストを
 *     横断して見られるわけではない。これは「連続同型を確率的に減らす best-effort」であって
 *     強い一意保証ではない。強保証が要るなら外部ストア（KV 等）が必要だが、本用途には過剰。
 *   - seed=randomUUID + 既存の avoid 再抽選があるため、ここが無くても多様性は出る。本モジュールは
 *     その上積みの保険。
 */

import type { StorySteerMeta } from "./prompts.ts";

type Stamped = { meta: StorySteerMeta; at: number };

const MAX = 12;
const TTL_MS = 90_000;

// module スコープ＝同一プロセス内で共有（インスタンス跨ぎは保証しない）。
const ring: Stamped[] = [];

/** TTL 切れを落としつつ、サーバが直近に出した型メタを新しい順で返す。 */
export function getRecentSteers(now: number = Date.now()): StorySteerMeta[] {
  prune(now);
  return ring.map((s) => s.meta).reverse();
}

/** 今回選んだ型メタをサーバ側リングに記録する。 */
export function recordSteer(meta: StorySteerMeta, now: number = Date.now()): void {
  prune(now);
  ring.push({ meta, at: now });
  while (ring.length > MAX) ring.shift();
}

function prune(now: number): void {
  while (ring.length > 0 && now - ring[0].at > TTL_MS) ring.shift();
}
