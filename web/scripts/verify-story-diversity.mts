/**
 * verify-story-diversity.mts — 多様性の実証（本番ルートは触らない検証専用）。
 *
 * ANTHROPIC_API_KEY が無い環境向け：実生成の代わりに、選ばれる steer（声/リビール/オチ/尺）と
 * 組み立てられた system/user プロンプトを複数入力・複数 seed でダンプし、ばらつきを示す。
 *
 * 実行: npx tsx scripts/verify-story-diversity.mts
 */
import {
  selectStorySteer,
  steerMeta,
  buildStorySystem,
  buildStoryUserMessage,
  VOICE_STEERS,
  REVEAL_TYPES,
  ENDING_FORMS,
  LENGTH_PROFILES,
} from "../src/lib/prompts.ts";
import { buildRefsBlock } from "../src/lib/corpus.ts";

const TAGSETS: string[][] = [
  ["トンネル", "女の霊", "つけてくる"],
  ["自室・ワンルーム", "黒い人影", "日常への侵食"], // 新軸＋新舞台
  ["神社・祠", "祖父母の昔語り", "因縁・家族の祟り"], // 新人物軸＋新展開軸
  ["深夜のコンビニ", "そっくりな誰か", "入れ替わる"],
];

function rngSeeds(n: number): string[] {
  // 検証の再現性のため固定 seed 列（本番は randomUUID）。
  return Array.from({ length: n }, (_, i) => `seed-${i}`);
}

console.log("================ STEER DIVERSITY ================");
console.log(
  `pools: voice=${VOICE_STEERS.length} reveal=${REVEAL_TYPES.length} ending=${ENDING_FORMS.length} length=${LENGTH_PROFILES.length}\n`,
);

// 1) 同一モチーフを引き直す（seed だけ変える）→ 質感が変わることを示す
console.log("--- 同一モチーフ・seed違い（再ロールで質感が変わる） ---");
const fixed = TAGSETS[0];
for (const seed of rngSeeds(6)) {
  const m = steerMeta(selectStorySteer(fixed, seed));
  console.log(`[${fixed.join("/")}] ${seed} -> voice=${m.voice} reveal=${m.reveal} ending=${m.ending} length=${m.length}`);
}

// 2) 軸違いのモチーフ × seed → 全体のばらけ
console.log("\n--- 異なる軸選択 × seed（型のばらけ） ---");
const counts = { voice: {}, reveal: {}, ending: {}, length: {} } as Record<string, Record<string, number>>;
const combos = new Set<string>();
for (const tags of TAGSETS) {
  for (const seed of rngSeeds(8)) {
    const m = steerMeta(selectStorySteer(tags, seed));
    for (const k of ["voice", "reveal", "ending", "length"] as const) {
      counts[k][m[k]] = (counts[k][m[k]] ?? 0) + 1;
    }
    combos.add(`${m.voice}|${m.reveal}|${m.ending}|${m.length}`);
  }
}
console.log("distinct (voice,reveal,ending,length) combos:", combos.size, "/ 32 runs");
for (const k of ["voice", "reveal", "ending", "length"] as const) {
  console.log(`${k}:`, counts[k]);
}

// 3) 履歴ローテ（直近型を避ける）
console.log("\n--- 履歴ローテ（連続同型を避ける） ---");
const hist: ReturnType<typeof steerMeta>[] = [];
for (let i = 0; i < 5; i++) {
  const m = steerMeta(selectStorySteer(fixed, `fixed-seed`, hist));
  console.log(`run${i}: voice=${m.voice} reveal=${m.reveal} ending=${m.ending}`);
  hist.push(m);
}
console.log("(seed固定でも履歴回避で voice/reveal/ending の全一致を避けている)");

// 4) 1サンプルの system/user プロンプト全文ダンプ
console.log("\n================ SAMPLE PROMPT DUMP ================");
const sampleTags = TAGSETS[1];
const sampleSteer = selectStorySteer(sampleTags, "demo");
const refs = buildRefsBlock(sampleTags);
console.log(">>> TAGS:", sampleTags.join(" / "));
console.log(">>> META:", JSON.stringify(steerMeta(sampleSteer)));
console.log("\n----- SYSTEM -----\n" + buildStorySystem(sampleSteer));
console.log("\n----- USER -----\n" + buildStoryUserMessage(sampleTags, refs, sampleSteer));

// 5) RAG excerpt: 末尾(オチ)が含まれていることの確認
console.log("\n================ RAG EXCERPT (head+tail) ================");
console.log(buildRefsBlock(["トンネル", "女の霊", "つけてくる"]).slice(0, 900));
