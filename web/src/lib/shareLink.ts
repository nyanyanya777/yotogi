/**
 * shareLink.ts — 旧 `/story?s=<token>` 共有リンクのデコード（後方互換）。
 *
 * かつては怪談本文を URL に内包して共有していた（`/story?s=<base64url(JSON)>`）が、
 * URL が長すぎる（約330字）ため新規シェアでは廃止。現在の共有は短いアプリ URL +
 * 「タイトル＋さわり」テキスト（src/app/story/page.tsx handleShare）。
 *
 * decodeStory は既存の長い `?s=` リンクで来た相手のために残置する。
 * encodeStory は新規生成では使わない（後方互換のため export は残す）。
 *
 * JSON は {t:title, b:body, g:tags} のコンパクト形。UTF-8 を base64url で安全に運ぶ。
 * デコード側は形と長さを検証し、壊れた/巨大な入力は null を返す（自タブ保護）。
 */

import type { StoredStory } from "./yotogiStorage";

export type SharedStory = { title: string; body: string; tags: string[] };

// デコード時の上限（巨大URLで自タブを膨らませない）。
const MAX_TITLE = 120;
const MAX_BODY = 8000;
const MAX_TAG = 60;

function b64urlEncode(json: string): string {
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** 現在の怪談を共有リンク用トークンにエンコードする。 */
export function encodeStory(story: StoredStory, tags: string[]): string {
  return b64urlEncode(JSON.stringify({ t: story.title, b: story.body, g: tags }));
}

/** 共有トークンを検証付きでデコードする。壊れていれば null。 */
export function decodeStory(token: string): SharedStory | null {
  try {
    const o = JSON.parse(b64urlDecode(token)) as {
      t?: unknown;
      b?: unknown;
      g?: unknown;
    };
    if (typeof o.t !== "string" || typeof o.b !== "string") return null;
    if (o.t.length === 0 || o.t.length > MAX_TITLE) return null;
    if (o.b.length === 0 || o.b.length > MAX_BODY) return null;
    let tags: string[] = [];
    if (Array.isArray(o.g)) {
      tags = o.g
        .filter((x): x is string => typeof x === "string" && x.length <= MAX_TAG)
        .slice(0, 3);
    }
    return { title: o.t, body: o.b, tags };
  } catch {
    return null;
  }
}
