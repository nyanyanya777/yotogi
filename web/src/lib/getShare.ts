/**
 * getShare.ts — 共有怪談（`/api/share` で Vercel Blob に保存）を ID から復元する。
 *
 * `head` で公開 URL を引き、fetch して JSON を検証する。見つからない / 壊れている
 * 場合は null を返す。`/s/[id]` のページ・generateMetadata・OG 画像生成
 * （opengraph-image）の三者が同じ取得・検証ロジックを共有し、リクエスト内で
 * 三重取得しないよう React の cache でメモ化する。
 *
 * @vercel/blob（Node API）を使うため、import 側は runtime = "nodejs" であること。
 */

import { cache } from "react";
import { head } from "@vercel/blob";

export type Shared = { title: string; body: string; tags: string[] };

// 保存側 makeShareId の出力（base64url 12 文字想定）に合わせた緩めの許容形。
// 想定外のパスセグメント（traversal 等）を Blob に渡さないためのガード。
const ID_RE = /^[A-Za-z0-9_-]{6,24}$/;

// 取得時の上限（巨大 JSON で SSR を膨らませない）。
const MAX_TITLE = 120;
const MAX_BODY = 8000;

/**
 * ID から共有怪談を取得する。head で公開 URL を引き、fetch して JSON を検証。
 * 見つからない/壊れている場合は null。generateMetadata・本体・OG 画像で
 * 多重取得しないよう React の cache でメモ化する。
 */
export const getShare = cache(async (id: string): Promise<Shared | null> => {
  if (!ID_RE.test(id)) return null;
  try {
    const meta = await head(`shares/${id}.json`);
    const res = await fetch(meta.url, { cache: "force-cache" });
    if (!res.ok) return null;
    const o = (await res.json()) as {
      title?: unknown;
      body?: unknown;
      tags?: unknown;
    };
    if (typeof o.title !== "string" || typeof o.body !== "string") return null;
    if (o.title.length === 0 || o.title.length > MAX_TITLE) return null;
    if (o.body.length === 0 || o.body.length > MAX_BODY) return null;
    const tags = Array.isArray(o.tags)
      ? o.tags.filter((t): t is string => typeof t === "string").slice(0, 3)
      : [];
    return { title: o.title, body: o.body, tags };
  } catch {
    // BlobNotFoundError / ネットワーク / JSON 不正など。
    return null;
  }
});
