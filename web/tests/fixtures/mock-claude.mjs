/**
 * Mock Claude scenario harness — deterministic, used by simulated tests.
 */

export function makeMockClaude(scenarios) {
  let i = 0;
  return {
    async complete() {
      const s = scenarios[i++ % scenarios.length];
      if (s.throw) throw new Error(s.throw);
      return s.response;
    },
  };
}

/** Tag-combination enumeration: 3 stage × 3 being × 3 attribute = 27 */
export const STAGES = ["学校・施設", "水辺・井戸・海", "山・峠・トンネル"];
export const BEINGS = ["女の霊・悪霊", "子ども・赤子の霊", "異形・正体不明"];
export const ATTRS = ["呪い・祟り", "錯乱（見えなくなる）", "神隠し・行方不明"];

export const ALL_27 = (() => {
  const out = [];
  for (const s of STAGES)
    for (const b of BEINGS)
      for (const a of ATTRS) out.push([s, b, a]);
  return out;
})();

/** Keyword set per tag — used to assert refs/body relevance. */
export const TAG_KEYWORDS = {
  "学校・施設": ["学校", "教室", "校舎", "施設", "病院", "廊下", "保健室"],
  "水辺・井戸・海": ["水", "井戸", "海", "川", "湖", "池", "水面", "水底"],
  "山・峠・トンネル": ["山", "峠", "トンネル", "森", "林道", "坂"],
  "女の霊・悪霊": ["女", "霊", "悪霊", "髪", "顔"],
  "子ども・赤子の霊": ["子ども", "子供", "赤子", "赤ん坊", "童"],
  "異形・正体不明": ["異形", "正体", "影", "得体", "化け物", "もの"],
  "呪い・祟り": ["呪い", "祟り", "呪", "報い"],
  "錯乱（見えなくなる）": ["見え", "錯乱", "視界", "失う", "消え"],
  "神隠し・行方不明": ["神隠し", "行方", "消え", "失踪"],
};
