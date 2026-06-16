/**
 * POST /api/generate-story
 *
 * 入力: { tags: [string, string, string] }
 * 出力: { title: string, body: string }
 *
 * - corpus.json から 3 タグに合致する話を最大 3 件 RAG 抽出して {refs} に埋める。
 * - 怪談本文は callStoryModel (claude-sonnet-4-6) で生成する。
 * - LLM_PROVIDER=disabled / ANTHROPIC_API_KEY 未設定 / 失敗時は fallback を返す。
 */

import { NextRequest } from "next/server";
import { extractJson } from "@/lib/anthropic";
import { buildRefsBlock } from "@/lib/corpus";
import { fallbackStory, type StoryOutput } from "@/lib/fallback";
import { callStoryModel, isDisabled } from "@/lib/llm";
import { STORY_SYSTEM, buildStoryUserMessage } from "@/lib/prompts";

// fs.readFileSync を使うので Node runtime を強制。
export const runtime = "nodejs";
// 生成毎に変わるので dynamic。
export const dynamic = "force-dynamic";

type Body = { tags?: unknown };

function isStringTriple(x: unknown): x is [string, string, string] {
  return (
    Array.isArray(x) &&
    x.length === 3 &&
    x.every((v) => typeof v === "string" && v.trim().length > 0)
  );
}

export async function POST(req: NextRequest) {
  let parsed: Body;
  try {
    parsed = (await req.json()) as Body;
  } catch {
    return Response.json(
      { error: "invalid json body" },
      { status: 400 },
    );
  }

  if (!isStringTriple(parsed.tags)) {
    return Response.json(
      { error: "tags must be a string[3]" },
      { status: 400 },
    );
  }

  const tags = parsed.tags;

  // provider が disabled（key 無し or 明示 disabled）なら fallback。
  if (isDisabled()) {
    return Response.json(fallbackStory(tags), {
      headers: { "x-yotogi-source": "fallback-no-key" },
    });
  }

  try {
    const refs = buildRefsBlock(tags);
    const userMessage = buildStoryUserMessage(tags, refs);
    const text = await callStoryModel(STORY_SYSTEM, userMessage, {
      maxTokens: 2000,
      json: true,
    });

    const json = extractJson<StoryOutput>(text);
    if (
      !json ||
      typeof json.title !== "string" ||
      typeof json.body !== "string"
    ) {
      throw new Error("model returned malformed JSON");
    }

    return Response.json(
      { title: json.title, body: json.body } satisfies StoryOutput,
      { headers: { "x-yotogi-source": "claude" } },
    );
  } catch (err) {
    console.error("[generate-story] error:", err);
    return Response.json(fallbackStory(tags), {
      headers: { "x-yotogi-source": "fallback-error" },
    });
  }
}
