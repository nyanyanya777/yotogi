/**
 * fallback.ts — ANTHROPIC_API_KEY 未設定や API エラー時にフロントが UI 確認できるよう
 * 固定の怪談と解説を返す。タグの内容に応じて軽く文言を変える程度（決定論）。
 */

export type StoryOutput = {
  title: string;
  body: string;
};

export type FolkloreOutput = {
  denshou_no_kata: string;
  butai_no_imi: string;
  eranda_motif: string;
};

export function fallbackStory(tags: string[]): StoryOutput {
  // story/page.tsx で表示している固定文をベースにする。
  const body =
    "その井戸は、村のいちばん奥にあった。誰も水を汲まないのに、夜になると底から、子どもの声がした。\n\n" +
    "「覗いてはいけない」と祖母は言った。覗いた者は、次の夏には居なくなる。けれど私は、声の主が知りたかった。\n\n" +
    "縁に手をかけ、暗い水面を見下ろす。そこに、白い顔がひとつ。それは、私を見上げて、たしかに笑った。\n\n" +
    "あれから半年、夏でもないのに私の右の耳だけがいつも冷たい。風呂で湯に浸かっても、そこだけは水底の温度のままだ。" +
    `（モチーフ: ${tags.join(" / ")}）`;

  return {
    title: "井戸を覗くな",
    body,
  };
}

export function fallbackFolklore(
  tags: string[],
  _title: string,
  _body: string,
): FolkloreOutput {
  return {
    denshou_no_kata:
      "井戸の底に女霊や子の霊が宿るという話形は、東日本では「井戸女」、西日本では「井戸の子守」として広く採録されてきたとされる。覗いてはいけないと禁じられた水を覗いてしまう筋は、いわゆる「見るなの座敷」型の禁忌譚の延長として整理できる、というのが一つの見方である。",
    butai_no_imi:
      "井戸は古来、地上と地下水脈を結ぶ垂直の穴であり、此岸と彼岸を分ける境界の一つとされてきた。柳田國男や折口信夫の議論を引けば、水底は他界（水界他界）の一形態であり、覗き込む行為は境界を越えて向こうを見てしまうことに等しい。実利的な水源保全の戒律と異界接触への畏れが折り重なっている。",
    eranda_motif: `あなたが選んだ「${tags.join("／")}」は、いずれも水・霊・禁忌という民俗学的に親和性の高い組み合わせで、水神信仰の負の側面を構成している。`,
  };
}
