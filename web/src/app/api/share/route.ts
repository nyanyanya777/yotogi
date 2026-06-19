/**
 * POST /api/share
 *
 * 入力: { title: string, body: string, tags?: string[] }
 * 出力: { id: string }
 *
 * 怪談本文をサーバ（Vercel Blob）に保存し、短い共有 ID を払い出す。受け手は
 * `/s/<id>` を開くと保存された怪談が復元・表示される（src/app/s/[id]/page.tsx）。
 *
 * 旧方式は本文を base64url で URL に内包していた（約330字の長い `?s=` リンク）が、
 * 長すぎるため廃止。後方互換のデコードのみ shareLink.ts に残置。
 *
 * 濫用対策（コスト/DoS）: 既存の generate 系と同じレート制限・入力長ガードを流用。
 * Blob ストアの肥大と無制限書き込みを抑える。
 */

import { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import {
  MAX_BODY_LEN,
  MAX_REQUEST_BYTES,
  MAX_TAG_LEN,
  MAX_TITLE_LEN,
  checkRateLimit,
  isRequestTooLarge,
  isStrWithin,
  tooManyRequests,
} from "@/lib/apiGuards";

// crypto / @vercel/blob のため Node runtime を強制。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { title?: unknown; body?: unknown; tags?: unknown };

/**
 * 短い共有 ID を生成する。crypto の乱数 9 バイトを base64url 化（= 12 文字）。
 * 72 bit のエントロピーがあり実用上衝突しない。`-` `_` はパスセグメントで安全。
 */
function makeShareId(): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** tags を 0〜3 個の妥当な文字列配列に正規化する。 */
function normalizeTags(x: unknown): string[] {
  if (!Array.isArray(x)) return [];
  return x
    .filter((v): v is string => typeof v === "string" && v.length <= MAX_TAG_LEN)
    .slice(0, 3);
}

export async function POST(req: NextRequest) {
  // 濫用対策: レート制限 → リクエスト肥大の早期拒否。
  const rl = checkRateLimit(req);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  if (isRequestTooLarge(req)) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  // 保存先が未設定（ローカルでトークン無し等）の場合は 503 で明示。
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return Response.json(
      { error: "share store not configured" },
      { status: 503 },
    );
  }

  let parsed: Body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_REQUEST_BYTES) {
      return Response.json({ error: "payload too large" }, { status: 413 });
    }
    parsed = JSON.parse(raw) as Body;
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!isStrWithin(parsed.title, MAX_TITLE_LEN)) {
    return Response.json({ error: "invalid title" }, { status: 400 });
  }
  if (!isStrWithin(parsed.body, MAX_BODY_LEN)) {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }

  const payload = {
    title: parsed.title,
    body: parsed.body,
    tags: normalizeTags(parsed.tags),
  };

  try {
    const id = makeShareId();
    await put(`shares/${id}.json`, JSON.stringify(payload), {
      access: "public",
      contentType: "application/json",
      addRandomSuffix: false,
      // 共有内容は不変。長期キャッシュで配信負荷を抑える。
      cacheControlMaxAge: 31_536_000,
    });
    return Response.json({ id });
  } catch (err) {
    console.error("[share] put error:", err);
    return Response.json({ error: "failed to save share" }, { status: 500 });
  }
}
