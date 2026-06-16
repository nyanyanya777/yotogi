/**
 * llm-e2e.mjs — `src/lib/llm.ts` の provider 切替動作を検証する。
 *
 * 走らせ方:
 *   node --experimental-strip-types --no-warnings scripts/llm-e2e.mjs
 *
 * 目的:
 *   - LLM_PROVIDER の各値で getProvider() が正しく切り替わる
 *   - hybrid モードで Ollama が落ちている (接続失敗) ときに Sonnet にフォールバックする
 *   - local モードで Ollama も Anthropic も無いと throw する（呼び出し側 fallback 発火）
 *   - 各 phase で渡される model 名が仕様通り
 *
 * 実 LLM/Anthropic API は叩かない。callClaude と callOllama を環境で差し替える方法が無いので、
 * グローバル fetch を差し替えて mock する。Anthropic SDK は `process.env.ANTHROPIC_API_KEY`
 * の有無で getAnthropicClient() の返値が変わるので、テスト先頭で setup する。
 */

import assert from "node:assert/strict";

// ── 環境 mock helpers ──────────────────────────────────────
const ENV_KEYS = [
  "LLM_PROVIDER",
  "ANTHROPIC_API_KEY",
  "OLLAMA_BASE_URL",
  "OLLAMA_DRAFT_MODEL",
  "OLLAMA_VERIFIER_MODEL",
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
function setEnv(patch) {
  for (const k of ENV_KEYS) {
    if (k in patch) {
      if (patch[k] === undefined) delete process.env[k];
      else process.env[k] = patch[k];
    }
  }
}
function restoreEnv() {
  for (const k of ENV_KEYS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k];
  }
}

// ── fetch mock helpers ────────────────────────────────────
const originalFetch = globalThis.fetch;
/** request log と handler mapping を持つ controller を作る */
function installFetchMock(routes) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const u = String(url);
    calls.push({ url: u, init });
    for (const r of routes) {
      if (r.match(u)) return r.handler(u, init);
    }
    throw new Error(`unhandled fetch ${u}`);
  };
  return {
    calls,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}
function jsonResp(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ── module loader: fresh import per case ──────────────────
/**
 * Anthropic クライアントはモジュールキャッシュされているので、
 * 各テストの前に __resetAnthropicClientForTests() を呼んで再構築させる。
 * これにより、グローバル fetch を差し替えた後で
 * SDK が新しい fetch を Shims から拾い直す。
 */
async function freshLlm() {
  const anth = await import("../src/lib/anthropic.ts");
  anth.__resetAnthropicClientForTests();
  return import("../src/lib/llm.ts");
}

// ── テスト ────────────────────────────────────────────────
let pass = 0;
let fail = 0;
const failures = [];

async function t(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    fail++;
    failures.push({ name, err: e });
    console.log(`  FAIL ${name}\n      ${e?.stack || e}`);
  }
}

// ──────────────────────────────────────────────────────────
// 1) getProvider() の判定マトリクス
// ──────────────────────────────────────────────────────────
async function suite_provider_matrix() {
  console.log("\n[suite] getProvider() matrix");

  await t("LLM_PROVIDER=anthropic → 'anthropic'", async () => {
    setEnv({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "anthropic");
  });

  await t("LLM_PROVIDER=hybrid → 'hybrid'", async () => {
    setEnv({ LLM_PROVIDER: "hybrid", ANTHROPIC_API_KEY: "sk-test" });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "hybrid");
  });

  await t("LLM_PROVIDER=local → 'local'", async () => {
    setEnv({ LLM_PROVIDER: "local", ANTHROPIC_API_KEY: undefined });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "local");
  });

  await t("LLM_PROVIDER=disabled → 'disabled'", async () => {
    setEnv({ LLM_PROVIDER: "disabled", ANTHROPIC_API_KEY: "sk-test" });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "disabled");
  });

  await t("unset + key set → 'anthropic'", async () => {
    setEnv({ LLM_PROVIDER: undefined, ANTHROPIC_API_KEY: "sk-test" });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "anthropic");
  });

  await t("unset + no key → 'disabled'", async () => {
    setEnv({ LLM_PROVIDER: undefined, ANTHROPIC_API_KEY: undefined });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "disabled");
  });

  await t("garbage value + key set → 'anthropic' (fallback)", async () => {
    setEnv({ LLM_PROVIDER: "weird", ANTHROPIC_API_KEY: "sk-test" });
    const { getProvider } = await freshLlm();
    assert.equal(getProvider(), "anthropic");
  });
}

// ──────────────────────────────────────────────────────────
// 2) callOllama 直接: 成功 / 失敗 / 5xx / empty
// ──────────────────────────────────────────────────────────
async function suite_ollama_direct() {
  console.log("\n[suite] callOllama direct");

  await t("ollama success returns content", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      ANTHROPIC_API_KEY: undefined,
      OLLAMA_BASE_URL: "http://mock-host:11434",
    });
    const fm = installFetchMock([
      {
        match: (u) => u.includes("/api/chat"),
        handler: () => jsonResp({ message: { role: "assistant", content: "OK-RESP" } }),
      },
    ]);
    try {
      const { callOllama } = await freshLlm();
      const out = await callOllama({
        model: "gemma3:27b",
        system: "S",
        userMessage: "U",
      });
      assert.equal(out, "OK-RESP");
      assert.equal(fm.calls.length, 1);
      const body = JSON.parse(fm.calls[0].init.body);
      assert.equal(body.model, "gemma3:27b");
      assert.equal(body.stream, false);
      assert.deepEqual(body.messages, [
        { role: "system", content: "S" },
        { role: "user", content: "U" },
      ]);
    } finally {
      fm.restore();
    }
  });

  await t("ollama network failure throws", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      OLLAMA_BASE_URL: "http://mock-host:11434",
    });
    const fm = installFetchMock([
      {
        match: () => true,
        handler: () => {
          throw new Error("ECONNREFUSED");
        },
      },
    ]);
    try {
      const { callOllama } = await freshLlm();
      await assert.rejects(
        () => callOllama({ model: "x", system: "S", userMessage: "U" }),
        /ollama fetch failed/,
      );
    } finally {
      fm.restore();
    }
  });

  await t("ollama 500 throws", async () => {
    const fm = installFetchMock([
      { match: () => true, handler: () => new Response("err", { status: 500 }) },
    ]);
    try {
      const { callOllama } = await freshLlm();
      await assert.rejects(
        () => callOllama({ model: "x", system: "S", userMessage: "U" }),
        /ollama HTTP 500/,
      );
    } finally {
      fm.restore();
    }
  });

  await t("ollama empty content throws", async () => {
    const fm = installFetchMock([
      {
        match: () => true,
        handler: () => jsonResp({ message: { role: "assistant", content: "" } }),
      },
    ]);
    try {
      const { callOllama } = await freshLlm();
      await assert.rejects(
        () => callOllama({ model: "x", system: "S", userMessage: "U" }),
        /empty content/,
      );
    } finally {
      fm.restore();
    }
  });

  await t("ollama format=json passes through when json opt set", async () => {
    const fm = installFetchMock([
      {
        match: () => true,
        handler: () => jsonResp({ message: { content: "{\"x\":1}" } }),
      },
    ]);
    try {
      const { callOllama } = await freshLlm();
      const out = await callOllama({
        model: "g",
        system: "S",
        userMessage: "U",
        json: true,
      });
      assert.equal(out, "{\"x\":1}");
      const body = JSON.parse(fm.calls[0].init.body);
      assert.equal(body.format, "json");
    } finally {
      fm.restore();
    }
  });
}

// ──────────────────────────────────────────────────────────
// 3) phase 別ルーティング (各 provider × phase)
// ──────────────────────────────────────────────────────────
// Anthropic SDK の HTTP は fetch を使うのでこちらも mock 可。
// 既定の Anthropic ベースは https://api.anthropic.com/v1/messages。
async function suite_phase_routing() {
  console.log("\n[suite] phase routing");

  // anthropic モード: 全 phase が Sonnet を叩く
  await t("anthropic mode: story → Sonnet via Anthropic", async () => {
    setEnv({
      LLM_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://unused:11434",
    });
    const fm = installFetchMock([
      {
        match: (u) => u.includes("api.anthropic.com"),
        handler: (_, init) => {
          const body = JSON.parse(init.body);
          assert.equal(body.model, "claude-sonnet-4-6");
          return jsonResp({
            id: "x",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "STORY-OUT" }],
            model: body.model,
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        },
      },
    ]);
    try {
      const { callStoryModel } = await freshLlm();
      const out = await callStoryModel("S", "U");
      assert.equal(out, "STORY-OUT");
    } finally {
      fm.restore();
    }
  });

  await t("anthropic mode: draft → Sonnet via Anthropic (no ollama call)", async () => {
    setEnv({ LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "sk-test" });
    let ollamaHit = 0;
    const fm = installFetchMock([
      {
        match: (u) => u.includes("ollama"),
        handler: () => {
          ollamaHit++;
          return jsonResp({ message: { content: "X" } });
        },
      },
      {
        match: (u) => u.includes("api.anthropic.com"),
        handler: (_, init) => {
          const body = JSON.parse(init.body);
          assert.equal(body.model, "claude-sonnet-4-6");
          return jsonResp({
            id: "x",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "DRAFT-OUT" }],
            model: body.model,
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        },
      },
    ]);
    try {
      const { callDraftModel } = await freshLlm();
      const out = await callDraftModel("S", "U");
      assert.equal(out, "DRAFT-OUT");
      assert.equal(ollamaHit, 0, "ollama must not be called in anthropic mode");
    } finally {
      fm.restore();
    }
  });

  // hybrid: draft → ollama
  await t("hybrid mode: draft → Ollama gemma3:27b", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      ANTHROPIC_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://mock-ollama:11434",
    });
    let calledOllama = false;
    const fm = installFetchMock([
      {
        match: (u) => u.includes("mock-ollama"),
        handler: (_, init) => {
          calledOllama = true;
          const body = JSON.parse(init.body);
          assert.equal(body.model, "gemma3:27b");
          return jsonResp({ message: { content: "GEMMA-DRAFT" } });
        },
      },
    ]);
    try {
      const { callDraftModel } = await freshLlm();
      const out = await callDraftModel("S", "U");
      assert.equal(out, "GEMMA-DRAFT");
      assert.ok(calledOllama, "ollama should be called");
    } finally {
      fm.restore();
    }
  });

  await t("hybrid mode: story/verifier → Sonnet", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      ANTHROPIC_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://mock-ollama:11434",
    });
    const seen = [];
    const fm = installFetchMock([
      {
        match: (u) => u.includes("api.anthropic.com"),
        handler: (_, init) => {
          const body = JSON.parse(init.body);
          seen.push(body.model);
          return jsonResp({
            id: "x",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "ANT" }],
            model: body.model,
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        },
      },
      {
        match: () => true,
        handler: () => {
          throw new Error("ollama should not be hit here");
        },
      },
    ]);
    try {
      const { callStoryModel, callVerifierModel } = await freshLlm();
      await callStoryModel("S", "U");
      await callVerifierModel("S", "U");
      assert.deepEqual(seen, ["claude-sonnet-4-6", "claude-sonnet-4-6"]);
    } finally {
      fm.restore();
    }
  });

  // hybrid + ollama fails → fallback to Sonnet
  await t("hybrid + ollama down → draft falls back to Sonnet", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      ANTHROPIC_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://mock-ollama:11434",
    });
    let ollamaHit = 0;
    let anthHit = 0;
    const fm = installFetchMock([
      {
        match: (u) => u.includes("mock-ollama"),
        handler: () => {
          ollamaHit++;
          throw new Error("ECONNREFUSED");
        },
      },
      {
        match: (u) => u.includes("api.anthropic.com"),
        handler: (_, init) => {
          anthHit++;
          return jsonResp({
            id: "x",
            type: "message",
            role: "assistant",
            content: [{ type: "text", text: "SONNET-FALLBACK" }],
            model: JSON.parse(init.body).model,
            stop_reason: "end_turn",
            usage: { input_tokens: 1, output_tokens: 1 },
          });
        },
      },
    ]);
    try {
      const { callDraftModel } = await freshLlm();
      const out = await callDraftModel("S", "U");
      assert.equal(out, "SONNET-FALLBACK");
      assert.equal(ollamaHit, 1);
      assert.equal(anthHit, 1);
    } finally {
      fm.restore();
    }
  });

  await t("hybrid + ollama down + no key → throws (callers fallback)", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      ANTHROPIC_API_KEY: undefined,
      OLLAMA_BASE_URL: "http://mock-ollama:11434",
    });
    const fm = installFetchMock([
      { match: () => true, handler: () => { throw new Error("nope"); } },
    ]);
    try {
      const { callDraftModel } = await freshLlm();
      await assert.rejects(() => callDraftModel("S", "U"));
    } finally {
      fm.restore();
    }
  });

  // local mode
  await t("local mode: story → Ollama; verifier → Ollama qwen2.5", async () => {
    setEnv({
      LLM_PROVIDER: "local",
      ANTHROPIC_API_KEY: undefined,
      OLLAMA_BASE_URL: "http://mock-ollama:11434",
    });
    const seenModels = [];
    const fm = installFetchMock([
      {
        match: (u) => u.includes("mock-ollama"),
        handler: (_, init) => {
          const body = JSON.parse(init.body);
          seenModels.push(body.model);
          return jsonResp({ message: { content: "LOCAL-OUT" } });
        },
      },
    ]);
    try {
      const { callStoryModel, callVerifierModel } = await freshLlm();
      await callStoryModel("S", "U");
      await callVerifierModel("S", "U");
      assert.deepEqual(seenModels, ["gemma3:27b", "qwen2.5:32b"]);
    } finally {
      fm.restore();
    }
  });

  await t("OLLAMA_DRAFT_MODEL override is respected", async () => {
    setEnv({
      LLM_PROVIDER: "hybrid",
      ANTHROPIC_API_KEY: "sk-test",
      OLLAMA_BASE_URL: "http://mock-ollama:11434",
      OLLAMA_DRAFT_MODEL: "custom-llm:42b",
    });
    let seen = null;
    const fm = installFetchMock([
      {
        match: (u) => u.includes("mock-ollama"),
        handler: (_, init) => {
          seen = JSON.parse(init.body).model;
          return jsonResp({ message: { content: "OK" } });
        },
      },
    ]);
    try {
      const { callDraftModel } = await freshLlm();
      await callDraftModel("S", "U");
      assert.equal(seen, "custom-llm:42b");
    } finally {
      fm.restore();
    }
  });

  // disabled mode → throws on all phases
  await t("disabled mode: all phases throw", async () => {
    setEnv({ LLM_PROVIDER: "disabled", ANTHROPIC_API_KEY: "sk-test" });
    const { callStoryModel, callDraftModel, callVerifierModel } = await freshLlm();
    await assert.rejects(() => callStoryModel("S", "U"), /disabled/);
    await assert.rejects(() => callDraftModel("S", "U"), /disabled/);
    await assert.rejects(() => callVerifierModel("S", "U"), /disabled/);
  });
}

// ──────────────────────────────────────────────────────────
// 4) decideFolklore のゲート判定（route から import）
// ──────────────────────────────────────────────────────────
async function suite_gate() {
  console.log("\n[suite] folklore gate decideFolklore");
  const { decideFolklore } = await import("../src/lib/folkloreGate.ts");

  const good = {
    denshou_no_kata: "x".repeat(120),
    butai_no_imi: "y".repeat(120),
    eranda_motif: "z".repeat(100),
  };
  const revised = {
    denshou_no_kata: "a".repeat(120),
    butai_no_imi: "b".repeat(120),
    eranda_motif: "c".repeat(100),
  };

  await t("happy path: accurate true & grade 5 → draft", async () => {
    const r = decideFolklore(good, { accurate: true, grade: 5, violations: [] });
    assert.equal(r.kind, "accept");
    assert.equal(r.source, "draft");
    assert.equal(r.value, good);
  });

  await t("grade 4 borderline → draft", async () => {
    const r = decideFolklore(good, { accurate: true, grade: 4, violations: [] });
    assert.equal(r.source, "draft");
  });

  await t("grade 3 with revised → revised", async () => {
    const r = decideFolklore(good, {
      accurate: true,
      grade: 3,
      violations: [],
      revised,
    });
    assert.equal(r.source, "revised");
    assert.equal(r.value, revised);
  });

  await t("violations non-empty with revised → revised", async () => {
    const r = decideFolklore(good, {
      accurate: true,
      grade: 5,
      violations: ["AT 100 が根拠なし"],
      revised,
    });
    assert.equal(r.source, "revised");
  });

  await t("accurate false with revised → revised", async () => {
    const r = decideFolklore(good, {
      accurate: false,
      grade: 5,
      violations: [],
      revised,
    });
    assert.equal(r.source, "revised");
  });

  await t("verify missing → draft (verifyFailed)", async () => {
    const r = decideFolklore(good, null);
    assert.equal(r.source, "draft");
    assert.equal(r.meta?.verifyFailed, true);
  });

  await t("grade<4 no revised → fallback", async () => {
    const r = decideFolklore(good, { accurate: true, grade: 2, violations: [] });
    assert.equal(r.kind, "fallback");
  });

  await t("bad draft shape → fallback", async () => {
    const r = decideFolklore({ junk: 1 }, { accurate: true, grade: 5, violations: [] });
    assert.equal(r.kind, "fallback");
    assert.equal(r.reason, "draft_bad_shape");
  });

  await t("revised wrong shape → fallback", async () => {
    const r = decideFolklore(good, {
      accurate: false,
      grade: 1,
      violations: ["x"],
      revised: { broken: true },
    });
    assert.equal(r.kind, "fallback");
  });
}

// ──────────────────────────────────────────────────────────
// main
// ──────────────────────────────────────────────────────────
async function main() {
  try {
    await suite_provider_matrix();
    await suite_ollama_direct();
    await suite_phase_routing();
    await suite_gate();
  } finally {
    restoreEnv();
    globalThis.fetch = originalFetch;
  }

  console.log(`\nLLM E2E: ${pass} pass, ${fail} fail`);
  if (fail > 0) {
    for (const f of failures) {
      console.error(`- ${f.name}: ${f.err?.message || f.err}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(2);
});
