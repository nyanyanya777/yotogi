/**
 * folkloreGate.ts — 解説の 2 段ゲート判定ロジック。
 *
 * route.ts から分離してあるのは、Node の test ランナーが
 * next/server を解決できない（strip-types で実行する都合）ため。
 *
 * 仕様:
 *  - ドラフト壊れ → fallback (reason="draft_bad_shape")
 *  - verify が無い／形が変 → ドラフトを採用（検証失敗扱い）
 *  - accurate=true & grade>=4 & violations 空 → ドラフトを採用
 *  - 上記を満たさず revised が正しい形 → revised 採用
 *  - 上記を満たさず revised 無し → fallback (reason="revise_missing")
 */

import type { FolkloreOutput } from "./fallback.ts";

export type VerifyResult = {
  accurate?: boolean;
  grade?: number;
  violations?: string[];
  revised?: FolkloreOutput;
};

export type GateDecision =
  | {
      kind: "accept";
      source: "draft" | "revised";
      value: FolkloreOutput;
      meta?: Record<string, unknown>;
    }
  | { kind: "fallback"; reason: string };

export function isFolkloreShape(o: unknown): o is FolkloreOutput {
  if (!o || typeof o !== "object") return false;
  const r = o as Record<string, unknown>;
  return (
    typeof r.denshou_no_kata === "string" &&
    typeof r.butai_no_imi === "string" &&
    typeof r.eranda_motif === "string"
  );
}

export function decideFolklore(
  draft: unknown,
  verify: VerifyResult | null | undefined,
): GateDecision {
  if (!isFolkloreShape(draft)) {
    return { kind: "fallback", reason: "draft_bad_shape" };
  }
  if (!verify || typeof verify.accurate !== "boolean") {
    return {
      kind: "accept",
      source: "draft",
      value: draft,
      meta: { verifyFailed: true },
    };
  }
  const grade = typeof verify.grade === "number" ? verify.grade : 0;
  const violationsLen = verify.violations?.length ?? 0;
  if (verify.accurate && grade >= 4 && violationsLen === 0) {
    return { kind: "accept", source: "draft", value: draft };
  }
  if (verify.revised && isFolkloreShape(verify.revised)) {
    return {
      kind: "accept",
      source: "revised",
      value: verify.revised,
      meta: { revised: true },
    };
  }
  return { kind: "fallback", reason: "revise_missing" };
}
