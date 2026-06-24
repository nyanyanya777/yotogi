/**
 * anthropic.ts — @anthropic-ai/sdk のシンライト ラッパ。
 *
 * - モデルは Haiku 4.5 (claude-haiku-4-5-20251001) を既定。
 * - JSON 出力を要求し、本文末尾から JSON を抽出してパースする。
 * - キー欠落時は null クライアントを返し、呼び出し側で fallback を選ばせる。
 */

import Anthropic from "@anthropic-ai/sdk";

export const STORY_MODEL = "claude-haiku-4-5-20251001";
export const FOLKLORE_MODEL = "claude-haiku-4-5-20251001";

let client: Anthropic | null | undefined;

/**
 * Anthropic クライアントを取得（モジュールキャッシュ）。
 * ANTHROPIC_API_KEY が無い場合は null を返す。
 */
export function getAnthropicClient(): Anthropic | null {
  if (client !== undefined) return client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    client = null;
    return null;
  }
  client = new Anthropic({ apiKey: key });
  return client;
}

/**
 * テスト用: 環境変数や global fetch をテスト中に差し替えた後で
 * 次の getAnthropicClient() がキャッシュ無しで再構築できるようにする。
 * production コードからは呼ばない。
 */
export function __resetAnthropicClientForTests(): void {
  client = undefined;
}

/**
 * モデル応答から JSON オブジェクトを取り出す。
 * モデルが ```json ... ``` で包んだり、前置き／後置きを足してくることがあるので、
 * 1) ```json コードフェンス
 * 2) 最初の { から最後の } までのスライス
 * の順で抜き出して JSON.parse する。
 */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();

  // ```json ... ``` を優先
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1]) as T;
  }

  // 最初の { から対応する最後の } を切り出す
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(trimmed.slice(first, last + 1)) as T;
  }

  return JSON.parse(trimmed) as T;
}

/**
 * Messages API を呼び出して assistant の text を返す。
 * SDK の型差異に左右されないように、戻り値 content[].text を素朴に結合する。
 */
export async function callClaude(args: {
  model: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
  /** 語彙の揺らぎ用。未指定ならモデル既定（≒1.0）。 */
  temperature?: number;
  /** nucleus サンプリング。未指定なら設定しない。 */
  topP?: number;
}): Promise<string> {
  const c = getAnthropicClient();
  if (!c) throw new Error("ANTHROPIC_API_KEY is not set");

  const resp = await c.messages.create({
    model: args.model,
    max_tokens: args.maxTokens ?? 1500,
    system: args.system,
    messages: [{ role: "user", content: args.userMessage }],
    ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
    ...(args.topP !== undefined ? { top_p: args.topP } : {}),
  });

  // content は { type: "text", text: string } の配列。
  // 型互換のために any 経由ではなく素朴に走査する。
  const parts: string[] = [];
  for (const block of resp.content) {
    if (block.type === "text") parts.push(block.text);
  }
  return parts.join("");
}
