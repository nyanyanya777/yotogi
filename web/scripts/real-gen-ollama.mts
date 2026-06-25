/**
 * real-gen-ollama.mts — 実生成での多様性検証（本番ルートを通す）。
 *
 * ANTHROPIC_API_KEY が無い環境のため、本番経路の callStoryModel を provider=local
 * （ollama gemma3:27b）で通して実生成する。selectStorySteer→buildStorySystem→
 * buildStoryUserMessage→callStoryModel→callOllama という配線は本番と同一。モデルだけ
 * Claude Sonnet ではなく gemma3:27b（プロンプト配線・多様性の実証用、文章品質は別物）。
 *
 * 実行: LLM_PROVIDER=local OLLAMA_DRAFT_MODEL=gemma3:27b npx tsx scripts/real-gen-ollama.mts
 */
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import {
  selectStorySteer,
  steerMeta,
  buildStorySystem,
  buildStoryUserMessage,
} from "../src/lib/prompts.ts";
import { buildRefsBlock } from "../src/lib/corpus.ts";
import { callStoryModel } from "../src/lib/llm.ts";
import { extractJson } from "../src/lib/anthropic.ts";

const STORY_TEMPERATURE = 0.95;

// 同一モチーフ3本（再ロールで質感が変わるか）＋別モチーフ3本（軸違いのばらけ）。
const RUNS: { tags: string[]; note: string }[] = [
  { tags: ["トンネル", "女の霊", "つけてくる"], note: "same#1" },
  { tags: ["トンネル", "女の霊", "つけてくる"], note: "same#2" },
  { tags: ["トンネル", "女の霊", "つけてくる"], note: "same#3" },
  { tags: ["自室・ワンルーム", "黒い人影", "日常への侵食"], note: "diff: 新舞台×新展開" },
  { tags: ["神社・祠", "祖父母の昔語り", "因縁・家族の祟り"], note: "diff: 新人物×新展開" },
  { tags: ["深夜のコンビニ", "そっくりな誰か", "入れ替わる"], note: "diff: 入れ替わり" },
];

const CLICHES = [
  "そのときは気にも留めなかった",
  "そのときは何とも思わなかった",
  "今でも忘れられない",
  "背筋が凍",
  "血の気が引",
  "そこには誰もいなかった",
  "言葉を失った",
  "振り返ると",
  "今でも",
  "病院",
  "耳鳴り",
];

type Out = { title: string; body: string };

function head(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n) + "…";
}

async function main() {
  const results: {
    note: string;
    tags: string[];
    meta: ReturnType<typeof steerMeta>;
    title: string;
    bodyLen: number;
    bodyHead: string;
    bodyTail: string;
    cliches: string[];
    body: string;
    error?: string;
  }[] = [];

  for (const run of RUNS) {
    const seed = randomUUID();
    const steer = selectStorySteer(run.tags, seed);
    const meta = steerMeta(steer);
    const refs = buildRefsBlock(run.tags);
    const system = buildStorySystem(steer);
    const user = buildStoryUserMessage(run.tags, refs, steer);

    process.stderr.write(
      `\n[gen] ${run.note} ${run.tags.join("/")}\n  meta=${JSON.stringify(meta)} maxTokens=${steer.length.maxTokens}\n`,
    );

    try {
      const text = await callStoryModel(system, user, {
        maxTokens: steer.length.maxTokens,
        json: true,
        temperature: STORY_TEMPERATURE,
      });
      const json = extractJson<Out>(text);
      const body = String(json.body ?? "");
      const found = CLICHES.filter((c) => body.includes(c));
      results.push({
        note: run.note,
        tags: run.tags,
        meta,
        title: String(json.title ?? ""),
        bodyLen: body.length,
        bodyHead: head(body.replace(/\n+/g, " "), 90),
        bodyTail: body.replace(/\n+/g, " ").slice(-80),
        cliches: found,
        body,
      });
      process.stderr.write(`  ok title=「${json.title}」 len=${body.length} cliches=${found.length}\n`);
    } catch (e) {
      results.push({
        note: run.note,
        tags: run.tags,
        meta,
        title: "",
        bodyLen: 0,
        bodyHead: "",
        bodyTail: "",
        cliches: [],
        body: "",
        error: (e as Error).message,
      });
      process.stderr.write(`  ERROR ${(e as Error).message}\n`);
    }
  }

  // 多様性サマリ
  const uniq = (xs: string[]) => Array.from(new Set(xs));
  const summary = {
    runs: results.length,
    distinctVoice: uniq(results.map((r) => r.meta.voice)),
    distinctReveal: uniq(results.map((r) => r.meta.reveal)),
    distinctEnding: uniq(results.map((r) => r.meta.ending)),
    distinctLength: uniq(results.map((r) => r.meta.length)),
    bodyLens: results.map((r) => r.bodyLen),
    totalClicheHits: results.reduce((a, r) => a + r.cliches.length, 0),
  };

  const outPath = "/Users/kohei/.openclaw/workspace/yotogi_work/web/scripts/real-gen-ollama-output.md";
  let md = `# YOTOGI 実生成 多様性検証（ollama gemma3:27b / 本番 callStoryModel 経路）\n\n`;
  md += `provider=local, model=gemma3:27b, temperature=${STORY_TEMPERATURE}\n\n`;
  md += `## サマリ\n\n`;
  md += `- 生成本数: ${summary.runs}\n`;
  md += `- distinct voice: ${summary.distinctVoice.join(", ")}\n`;
  md += `- distinct reveal: ${summary.distinctReveal.join(", ")}\n`;
  md += `- distinct ending: ${summary.distinctEnding.join(", ")}\n`;
  md += `- distinct length: ${summary.distinctLength.join(", ")}\n`;
  md += `- 本文字数: ${summary.bodyLens.join(", ")}\n`;
  md += `- クリシェ命中合計: ${summary.totalClicheHits}\n\n`;
  md += `## 各話\n\n`;
  for (const r of results) {
    md += `### ${r.note} — ${r.tags.join(" / ")}\n`;
    md += `- meta: voice=${r.meta.voice} / reveal=${r.meta.reveal} / ending=${r.meta.ending} / length=${r.meta.length}\n`;
    if (r.error) {
      md += `- ERROR: ${r.error}\n\n`;
      continue;
    }
    md += `- title:「${r.title}」 / 字数: ${r.bodyLen} / クリシェ: ${r.cliches.length ? r.cliches.join("、") : "なし"}\n`;
    md += `- 冒頭: ${r.bodyHead}\n`;
    md += `- オチ: …${r.bodyTail}\n\n`;
    md += `<details><summary>全文</summary>\n\n${r.body}\n\n</details>\n\n`;
  }

  fs.writeFileSync(outPath, md, "utf8");
  console.log(JSON.stringify(summary, null, 2));
  console.log("\nsaved:", outPath);
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
