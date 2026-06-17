/**
 * shareLink.ts — 怪談を URL に内包する共有リンクのエンコード/デコード。
 *
 * 怪談は localStorage にしか無いため、相手に「開いて読める」形で渡すには本文ごと
 * URL に載せる必要がある。`/story?s=<base64url(JSON)>` 形式。サーバDBは持たない。
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
