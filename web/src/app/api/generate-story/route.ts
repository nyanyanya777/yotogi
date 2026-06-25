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

import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { extractJson } from "@/lib/anthropic";
import { buildRefsBlock } from "@/lib/corpus";
import { fallbackStory, type StoryOutput } from "@/lib/fallback";
import { callStoryModel, isDisabled } from "@/lib/llm";
import {
  buildStorySystem,
  buildStoryUserMessage,
  selectStorySteer,
  steerMeta,
  type StorySteerMeta,
} from "@/lib/prompts";
import { getRecentSteers, recordSteer } from "@/lib/recentSteers";
import {
  MAX_REQUEST_BYTES,
  MAX_TAG_LEN,
  checkRateLimit,
  isRequestTooLarge,
  isStrWithin,
  tooManyRequests,
} from "@/lib/apiGuards";

// fs.readFileSync を使うので Node runtime を強制。
export const runtime = "nodejs";
// 生成毎に変わるので dynamic。
export const dynamic = "force-dynamic";

type Body = { tags?: unknown; history?: unknown };

// 語彙の揺らぎ用。型固定を避けたいので高め。top_p は素直に 1.0。
const STORY_TEMPERATURE = 0.95;

function isStringTriple(x: unknown): x is [string, string, string] {
  return (
    Array.isArray(x) &&
    x.length === 3 &&
    x.every((v) => isStrWithin(v, MAX_TAG_LEN))
  );
}

/**
 * クライアントから渡る直近の型メタ（連続同型を避ける軽いローテ用）。任意。
 * 形が違えば素直に無視する（過大設計しない）。
 */
function parseHistory(x: unknown): StorySteerMeta[] {
  if (!Array.isArray(x)) return [];
  const out: StorySteerMeta[] = [];
  for (const it of x.slice(-5)) {
    if (it && typeof it === "object") {
      const o = it as Record<string, unknown>;
      if (
        typeof o.voice === "string" &&
        typeof o.reveal === "string" &&
        typeof o.ending === "string" &&
        typeof o.length === "string"
      ) {
        out.push({
          voice: o.voice,
          reveal: o.reveal,
          ending: o.ending,
          length: o.length,
        });
      }
    }
  }
  return out;
}

export async function POST(req: NextRequest) {
  // 濫用対策（コスト/DoS）: レート制限 → リクエスト肥大の早期拒否。
  const rl = checkRateLimit(req);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);
  if (isRequestTooLarge(req)) {
    return Response.json({ error: "payload too large" }, { status: 413 });
  }

  let parsed: Body;
  try {
    // content-length に依存せず本文サイズを上限で弾く（チャンク送信対策）。
    const raw = await req.text();
    if (raw.length > MAX_REQUEST_BYTES) {
      return Response.json({ error: "payload too large" }, { status: 413 });
    }
    parsed = JSON.parse(raw) as Body;
  } catch {
    return Response.json({ error: "invalid json body" }, { status: 400 });
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

  // 回ごとに変わる nonce。同じモチーフを引き直しても別の質感が出るように。
  const seed = randomUUID();
  // 避けたい直近型 = クライアント送信 history ∪ サーバ側プロセス内の直近メタ（best-effort）。
  // クライアントが history を送らない初回や別タブ連打でも、連続同型を確率的に減らす。
  const clientHistory = parseHistory(parsed.history);
  const avoid = [...clientHistory, ...getRecentSteers()].slice(-5);
  const steer = selectStorySteer(tags, seed, avoid);
  const meta = steerMeta(steer);
  // 今回選んだ型をサーバ側リングへ記録（次リクエストの被り回避に使う）。
  recordSteer(meta);

  try {
    const refs = buildRefsBlock(tags);
    const system = buildStorySystem(steer);
    const userMessage = buildStoryUserMessage(tags, refs, steer);
    const text = await callStoryModel(system, userMessage, {
      // 尺プロファイルに応じて上限トークンを変える（遅燃焼は長い）。
      maxTokens: steer.length.maxTokens,
      json: true,
      temperature: STORY_TEMPERATURE,
    });

    const json = extractJson<StoryOutput>(text);
    if (
      !json ||
      typeof json.title !== "string" ||
      typeof json.body !== "string"
    ) {
      throw new Error("model returned malformed JSON");
    }

    // 選んだ (voice/reveal/ending/length) を観測可能にする＝偏りを後から検証できる。
    return Response.json(
      { title: json.title, body: json.body, meta },
      {
        headers: {
          "x-yotogi-source": "claude",
          "x-yotogi-steer": JSON.stringify(meta),
        },
      },
    );
  } catch (err) {
    console.error("[generate-story] error:", err);
    return Response.json(fallbackStory(tags), {
      headers: { "x-yotogi-source": "fallback-error" },
    });
  }
}
