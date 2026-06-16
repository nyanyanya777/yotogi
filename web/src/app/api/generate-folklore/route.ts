/**
 * POST /api/generate-folklore
 *
 * 入力: { tags: [string,string,string], title: string, body: string }
 * 出力: { denshou_no_kata, butai_no_imi, eranda_motif }
 *
 * 2段ゲート構成:
 *   1. ドラフト: callDraftModel (gemma3:27b on ollama / sonnet fallback)
 *   2. 検証&再生成: callVerifierModel (claude-sonnet-4-6)
 *      - verifier.grade >= 4 かつ violations 空 → ドラフトを採用
 *      - verifier.revised があれば revised を採用
 *      - 検証自体が失敗（JSON 不正等）した場合はドラフトを採用
 *      - ドラフト自体が壊れていれば fallback に降りる
 *
 * LLM_PROVIDER=disabled / ANTHROPIC_API_KEY 未設定 / 失敗時は fallback を返す。
 */

import { NextRequest } from "next/server";
import { extractJson } from "@/lib/anthropic";
import { fallbackFolklore, type FolkloreOutput } from "@/lib/fallback";
import {
  decideFolklore,
  isFolkloreShape,
  type VerifyResult,
} from "@/lib/folkloreGate";
import { callDraftModel, callVerifierModel, isDisabled } from "@/lib/llm";
import {
  FOLKLORE_SYSTEM,
  FOLKLORE_VERIFIER_SYSTEM,
  buildFolkloreUserMessage,
  buildFolkloreVerifierUserMessage,
} from "@/lib/prompts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { tags?: unknown; title?: unknown; body?: unknown };

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
    return Response.json({ error: "invalid json body" }, { status: 400 });
  }

  if (!isStringTriple(parsed.tags)) {
    return Response.json(
      { error: "tags must be a string[3]" },
      { status: 400 },
    );
  }
  if (typeof parsed.title !== "string" || typeof parsed.body !== "string") {
    return Response.json(
      { error: "title and body must be strings" },
      { status: 400 },
    );
  }

  const tags = parsed.tags;
  const title = parsed.title;
  const body = parsed.body;

  if (isDisabled()) {
    return Response.json(fallbackFolklore(tags, title, body), {
      headers: { "x-yotogi-source": "fallback-no-key" },
    });
  }

  try {
    // ── stage 1: ドラフト ───────────────────────────────
    const draftUser = buildFolkloreUserMessage(tags, title, body);
    const draftText = await callDraftModel(FOLKLORE_SYSTEM, draftUser, {
      maxTokens: 1200,
      json: true,
    });

    let draft: FolkloreOutput;
    try {
      draft = extractJson<FolkloreOutput>(draftText);
    } catch {
      throw new Error("draft returned malformed JSON");
    }
    if (!isFolkloreShape(draft)) {
      throw new Error("draft has wrong shape");
    }

    // ── stage 2: 検証 ───────────────────────────────────
    let verify: VerifyResult | null = null;
    try {
      const verifyUser = buildFolkloreVerifierUserMessage(
        tags,
        title,
        body,
        draft,
      );
      const verifyText = await callVerifierModel(
        FOLKLORE_VERIFIER_SYSTEM,
        verifyUser,
        { maxTokens: 1200, json: true },
      );
      verify = extractJson<VerifyResult>(verifyText);
    } catch (e) {
      console.warn("[generate-folklore] verifier failed, using draft:", e);
      verify = null;
    }

    const decision = decideFolklore(draft, verify);
    if (decision.kind === "fallback") {
      console.warn(
        "[generate-folklore] gate fell back:",
        decision.reason,
      );
      return Response.json(fallbackFolklore(tags, title, body), {
        headers: { "x-yotogi-source": `fallback-gate-${decision.reason}` },
      });
    }

    return Response.json(decision.value satisfies FolkloreOutput, {
      headers: {
        "x-yotogi-source": "claude",
        "x-yotogi-stage": decision.source,
      },
    });
  } catch (err) {
    console.error("[generate-folklore] error:", err);
    return Response.json(fallbackFolklore(tags, title, body), {
      headers: { "x-yotogi-source": "fallback-error" },
    });
  }
}
