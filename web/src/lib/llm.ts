/**
 * llm.ts — 3層ハイブリッド LLM ルーター。
 *
 * Phase 役割:
 *   - callStoryModel    : 怪談本文生成 (claude-sonnet-4-6)
 *   - callDraftModel    : 解説ドラフト生成 (gemma3:27b on ollama → sonnet fallback)
 *   - callVerifierModel : 解説検証＆再生成 (claude-sonnet-4-6)
 *
 * 環境変数:
 *   LLM_PROVIDER:
 *     - "anthropic" (default): 全フェーズ Claude Sonnet
 *     - "hybrid": story=sonnet, draft=ollama, verifier=sonnet
 *     - "local":  draft & verifier = ollama (story も ollama にフォールバック)
 *     - "disabled" or unset (no API key): 呼び出し側で固定 fallback を選ばせる
 *   ANTHROPIC_API_KEY: Anthropic 認証キー (無い場合 isAnthropicAvailable() = false)
 *   OLLAMA_BASE_URL: ollama API ベース URL (default http://localhost:11434)
 *   OLLAMA_DRAFT_MODEL: ollama 側ドラフト用モデル (default gemma3:27b)
 *   OLLAMA_VERIFIER_MODEL: ollama 側検証用モデル (default qwen2.5:32b)
 *
 * 仕様:
 *   - 各 LlmCall は (system, user, opts?) -> Promise<string>。
 *   - ollama 接続失敗時 (network / 5xx) は自動で Anthropic Sonnet にフォールバック。
 *   - 両方失敗した場合は throw（呼び出し側で fallback() に切り替える）。
 */

import { callClaude, getAnthropicClient } from "./anthropic.ts";

export type LlmOpts = {
  /** モデルに JSON 出力をヒントとして強く促す（プロンプト末尾に注記）。default false */
  json?: boolean;
  /** 最大出力トークン。default 1500 */
  maxTokens?: number;
  /** サンプリング温度。語彙の揺らぎ用。未指定ならモデル既定。 */
  temperature?: number;
  /** nucleus サンプリング (top_p)。未指定なら設定しない。 */
  topP?: number;
};

export type LlmCall = (
  system: string,
  user: string,
  opts?: LlmOpts,
) => Promise<string>;

export type LlmProvider = "anthropic" | "hybrid" | "local" | "disabled";

export const STORY_SONNET_MODEL = "claude-sonnet-4-6";
export const VERIFIER_SONNET_MODEL = "claude-sonnet-4-6";

/** 環境変数から現在の provider を決定する。 */
export function getProvider(): LlmProvider {
  const raw = (process.env.LLM_PROVIDER ?? "").trim().toLowerCase();
  if (raw === "anthropic" || raw === "hybrid" || raw === "local" || raw === "disabled") {
    return raw as LlmProvider;
  }
  // 未設定: anthropic を default にするが、key が無ければ disabled。
  if (getAnthropicClient()) return "anthropic";
  return "disabled";
}

/** Anthropic が使えるか。 */
export function isAnthropicAvailable(): boolean {
  return getAnthropicClient() !== null;
}

/** 固定 fallback に降りるべきか（key も ollama も使う気が無い状態）。 */
export function isDisabled(): boolean {
  return getProvider() === "disabled";
}

// ─────────────────────────────────────────────────────────────
// Anthropic 経由の薄ラッパ（LlmCall 形）
// ─────────────────────────────────────────────────────────────

function makeAnthropicCall(model: string, defaultMaxTokens: number): LlmCall {
  return async (system, user, opts) => {
    return callClaude({
      model,
      system,
      userMessage: user,
      maxTokens: opts?.maxTokens ?? defaultMaxTokens,
      temperature: opts?.temperature,
      topP: opts?.topP,
    });
  };
}

// ─────────────────────────────────────────────────────────────
// Ollama 経由
// ─────────────────────────────────────────────────────────────

function getOllamaBase(): string {
  return process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
}

function getOllamaDraftModel(): string {
  return process.env.OLLAMA_DRAFT_MODEL ?? "gemma3:27b";
}

function getOllamaVerifierModel(): string {
  return process.env.OLLAMA_VERIFIER_MODEL ?? "qwen2.5:32b";
}

/**
 * Ollama /api/chat を呼んで assistant content を返す。
 * - OpenAI 互換 messages 形式。
 * - ネットワーク失敗・5xx・想定外レスポンスは throw（呼び出し側でフォールバック判断）。
 */
export async function callOllama(args: {
  baseUrl?: string;
  model: string;
  system: string;
  userMessage: string;
  maxTokens?: number;
  json?: boolean;
  temperature?: number;
  topP?: number;
}): Promise<string> {
  const base = args.baseUrl ?? getOllamaBase();
  const url = `${base.replace(/\/+$/, "")}/api/chat`;

  // Ollama は num_predict / format=json を options 経由で受ける。
  const payload: Record<string, unknown> = {
    model: args.model,
    stream: false,
    messages: [
      { role: "system", content: args.system },
      { role: "user", content: args.userMessage },
    ],
    options: {
      num_predict: args.maxTokens ?? 1500,
      ...(args.temperature !== undefined ? { temperature: args.temperature } : {}),
      ...(args.topP !== undefined ? { top_p: args.topP } : {}),
    },
  };
  if (args.json) payload.format = "json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    throw new Error(`ollama fetch failed: ${(e as Error).message}`);
  }

  if (!res.ok) {
    throw new Error(`ollama HTTP ${res.status}`);
  }

  // /api/chat の non-stream レスポンスは { message: { role, content }, ... }
  const raw = (await res.json()) as {
    message?: { role?: string; content?: string };
    error?: string;
  };
  if (raw.error) throw new Error(`ollama error: ${raw.error}`);
  const content = raw.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new Error("ollama returned empty content");
  }
  return content;
}

/**
 * Ollama 呼び出し失敗時に Anthropic Sonnet にフォールバックする LlmCall。
 * Anthropic も使えない場合は元のエラーを throw する。
 */
function makeOllamaWithFallback(
  ollamaModel: () => string,
  fallbackAnthropicModel: string,
  defaultMaxTokens: number,
): LlmCall {
  return async (system, user, opts) => {
    try {
      return await callOllama({
        model: ollamaModel(),
        system,
        userMessage: user,
        maxTokens: opts?.maxTokens ?? defaultMaxTokens,
        json: opts?.json,
        temperature: opts?.temperature,
        topP: opts?.topP,
      });
    } catch (e) {
      if (isAnthropicAvailable()) {
        console.warn(
          `[llm] ollama call failed (${(e as Error).message}); falling back to anthropic ${fallbackAnthropicModel}`,
        );
        return callClaude({
          model: fallbackAnthropicModel,
          system,
          userMessage: user,
          maxTokens: opts?.maxTokens ?? defaultMaxTokens,
          temperature: opts?.temperature,
          topP: opts?.topP,
        });
      }
      throw e;
    }
  };
}

// ─────────────────────────────────────────────────────────────
// 公開 API: フェーズ別呼び出し
// ─────────────────────────────────────────────────────────────

/**
 * 怪談本文生成 — Sonnet 固定（hybrid/anthropic）または ollama 経由（local）。
 * max_tokens default 1500。
 */
export const callStoryModel: LlmCall = async (system, user, opts) => {
  const provider = getProvider();
  if (provider === "disabled") {
    throw new Error("LLM disabled (no provider)");
  }

  if (provider === "local") {
    const fn = makeOllamaWithFallback(
      getOllamaDraftModel,
      STORY_SONNET_MODEL,
      1500,
    );
    return fn(system, user, opts);
  }

  // anthropic / hybrid: story は常に Sonnet
  const fn = makeAnthropicCall(STORY_SONNET_MODEL, 1500);
  return fn(system, user, opts);
};

/**
 * 解説ドラフト生成 — hybrid/local では ollama (gemma3:27b)、
 * anthropic では Sonnet。ollama 失敗時は Sonnet にフォールバック。
 * max_tokens default 1200。
 */
export const callDraftModel: LlmCall = async (system, user, opts) => {
  const provider = getProvider();
  if (provider === "disabled") {
    throw new Error("LLM disabled (no provider)");
  }

  if (provider === "anthropic") {
    const fn = makeAnthropicCall(STORY_SONNET_MODEL, 1200);
    return fn(system, user, opts);
  }

  // hybrid / local : ollama draft → sonnet fallback
  const fn = makeOllamaWithFallback(
    getOllamaDraftModel,
    STORY_SONNET_MODEL,
    1200,
  );
  return fn(system, user, opts);
};

/**
 * 解説検証＆再生成 — anthropic/hybrid では Sonnet、
 * local では ollama verifier（失敗時 Sonnet にフォールバック）。
 * max_tokens default 1200。
 */
export const callVerifierModel: LlmCall = async (system, user, opts) => {
  const provider = getProvider();
  if (provider === "disabled") {
    throw new Error("LLM disabled (no provider)");
  }

  if (provider === "local") {
    const fn = makeOllamaWithFallback(
      getOllamaVerifierModel,
      VERIFIER_SONNET_MODEL,
      1200,
    );
    return fn(system, user, opts);
  }

  // anthropic / hybrid: verifier は常に Sonnet
  const fn = makeAnthropicCall(VERIFIER_SONNET_MODEL, 1200);
  return fn(system, user, opts);
};
