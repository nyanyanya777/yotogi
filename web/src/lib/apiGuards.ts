/**
 * apiGuards.ts — 公開・無認証の生成エンドポイントを濫用から守る最小限のガード。
 *
 * 守る対象:
 *  - コスト/DoS: 1 リクエストで Claude を 1〜2 回叩く。無制限に呼ばれると Anthropic
 *    の請求が青天井になる。→ レート制限（IP 毎＋全体）と入力長の上限で抑える。
 *
 * 注意（本番運用）: ここのレート制限は **プロセス内メモリ** のため、サーバーレスでは
 * インスタンス毎にしか効かない（インスタンス間で共有されない）。単一インスタンスへの
 * 素朴な flood は止まるが、堅牢な保護には Vercel WAF のレート制限ルール、または
 * Upstash Redis 等の共有ストアを併用すること。入力長の上限はインスタンスに依らず効く。
 */

import type { NextRequest } from "next/server";

// ── 入力長の上限（1 リクエストあたりのプロンプト規模＝コストを束ねる）──
export const MAX_TAG_LEN = 60; // モチーフ 1 個（呪いで文字化けしても元長を保つので十分）
export const MAX_TITLE_LEN = 120;
export const MAX_BODY_LEN = 4000;
// 生の本文（バイト）。content-length での早期 413 用。本文4000字×3B＋余白。
export const MAX_REQUEST_BYTES = 32_768;

/** Content-Length が上限超過なら true（本文を読む前に弾く）。 */
export function isRequestTooLarge(req: NextRequest): boolean {
  const len = req.headers.get("content-length");
  if (!len) return false; // 無い場合は後段の JSON パース＋長さ検証に委ねる
  const n = Number(len);
  return Number.isFinite(n) && n > MAX_REQUEST_BYTES;
}

/** 文字列が空でなく上限以内か。 */
export function isStrWithin(x: unknown, max: number): x is string {
  return typeof x === "string" && x.trim().length > 0 && x.length <= max;
}

// ── レート制限（プロセス内・固定ウィンドウ）──
const WINDOW_MS = 60_000;
const PER_IP_MAX = 8; // 1 IP あたり 8 生成/分
const GLOBAL_MAX = 60; // 全体 60 生成/分（このインスタンスで）

type Bucket = { count: number; resetAt: number };
const ipBuckets = new Map<string, Bucket>();
const globalBucket: Bucket = { count: 0, resetAt: 0 };

/** リクエストから IP 由来のキーを得る（Vercel は x-forwarded-for を付与）。 */
export function clientKey(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

function hit(bucket: Bucket, max: number, now: number): { ok: boolean; retryAfter: number } {
  if (now >= bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + WINDOW_MS;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

// Map の無制限肥大を防ぐ簡易プルーニング。
function prune(now: number): void {
  if (ipBuckets.size < 5000) return;
  for (const [k, b] of ipBuckets) {
    if (now >= b.resetAt) ipBuckets.delete(k);
  }
}

/**
 * レート制限チェック。許可なら {ok:true}、超過なら {ok:false, retryAfter}（秒）。
 * IP 毎の上限と全体上限の両方を見る。
 */
export function checkRateLimit(req: NextRequest): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  prune(now);

  const g = hit(globalBucket, GLOBAL_MAX, now);
  if (!g.ok) return g;

  const key = clientKey(req);
  let b = ipBuckets.get(key);
  if (!b) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    ipBuckets.set(key, b);
  }
  return hit(b, PER_IP_MAX, now);
}

/** 429 レスポンスを組み立てる。 */
export function tooManyRequests(retryAfter: number): Response {
  return Response.json(
    { error: "rate limited" },
    { status: 429, headers: { "retry-after": String(Math.max(1, retryAfter)) } },
  );
}
