# YOTOGI Backend API Spec (v1 / MVP)

> 別エージェントがこれ1枚で実装できる粒度。曖昧な箇所は本書で**全部即決**してある。読み飛ばさず判断を上書きしないこと。

## 0. 確定事項サマリ（先に全部）

| 論点 | 決定 |
|---|---|
| エンドポイント数 | **2本**: `POST /api/generate-story` と `POST /api/generate-folklore` |
| LLM プロバイダ | **Anthropic Claude API** に統一（ローカル `gemma3:27b` は使わない） |
| 怪談モデル | `claude-3-5-sonnet-latest` 単段（GENERATION_PROMPT.md の品質ゲートはプロンプト内自己チェックに畳む） |
| 解説モデル（ドラフト） | `claude-3-5-haiku-latest`（FOLKLORE_COMMENTARY.md の Gemma 役） |
| 解説モデル（検証） | `claude-3-5-sonnet-latest`（FOLKLORE_COMMENTARY.md の Claude 検証ゲート役） |
| 解説の2段ゲート | **採用**。haiku ドラフト → sonnet 検証（accurate / grade ≥4 / 違反なし）。grade<4 か違反検出時は **sonnet 自身に書き直させて返す**（1回まで） |
| 怪談の2段ゲート | **不採用**。sonnet 単段で十分。コスト×レイテンシ削減 |
| コーパス参照（RAG） | ビルド時の事前計算なし。**ランタイムで `corpus.json` を全件メモリ展開し、3タグの語をキーワード OR 全文一致 + ランダム抽出で 3 件**。ベクトル検索・埋め込みは使わない |
| キャッシュ | **無し**。同じ3タグでも毎回新作生成 |
| 冪等性 | 捨てる。`Idempotency-Key` 受け取らない |
| 認証 | **不要**（MVP / Vercel Edge から公開）。レート制限は Vercel/Edge 標準 + IP ベース簡易制限のみ |
| 入力タグ語彙 | **フロント既存の9語彙**（舞台3 / 存在3 / 属性3）。`MotifSelection` ページの CATEGORIES と完全一致 |
| エラー fallback | **モック怪談 / モック解説を 200 で返す**（フロントが落ちない最優先）。`x-yotogi-fallback: true` ヘッダで明示 |
| ランタイム | Next.js **Route Handlers (Node.js runtime)**。Edge は不使用（`fs` で corpus を読むため） |
| ストリーミング | **v1 では使わない**。一括 JSON を返す（実装難度を下げる）。dawn 演出 8 秒で隠せる |
| タイムアウト | API 内部で **30 秒**。超えたら fallback |
| 文字数チェック | サーバ側で確定（後述）|

---

## 1. エンドポイント一覧

### 1.1 `POST /api/generate-story`

3タグから怪談（タイトル＋本文）を1本生成して返す。

#### Request

```http
POST /api/generate-story
Content-Type: application/json

{
  "tags": {
    "stage": "水辺・井戸・海",
    "being": "女の霊・悪霊",
    "attribute": "呪い・祟り"
  }
}
```

**フィールド仕様**

| key | 型 | 必須 | 制約 |
|---|---|---|---|
| `tags.stage` | string | yes | 下記「許容語彙」のいずれか |
| `tags.being` | string | yes | 同上 |
| `tags.attribute` | string | yes | 同上 |

**許容語彙（v1 / フロント `/motif` と完全一致）**

```ts
const VOCAB = {
  stage:     ["学校・施設", "水辺・井戸・海", "山・峠・トンネル"],
  being:     ["女の霊・悪霊", "子ども・赤子の霊", "異形・正体不明"],
  attribute: ["呪い・祟り", "錯乱（見えなくなる）", "神隠し・行方不明"],
} as const;
```

語彙外の値は **400 Bad Request**。

#### Response 200 OK

```json
{
  "id": "stry_2026-06-13T07-22-11Z_a1b2",
  "title": "井戸を覗くな",
  "body": "その井戸は、村のいちばん奥にあった。誰も水を汲まないのに、夜になると底から、子どもの声がした。…（中略）…縁に手をかけ、暗い水面を見下ろす。そこに、白い顔がひとつ。",
  "tags": {
    "stage": "水辺・井戸・海",
    "being": "女の霊・悪霊",
    "attribute": "呪い・祟り"
  },
  "meta": {
    "model": "claude-3-5-sonnet-latest",
    "elapsedMs": 6420,
    "bodyChars": 487,
    "titleChars": 7
  }
}
```

| key | 型 | 説明 |
|---|---|---|
| `id` | string | `stry_<iso8601>_<rand4hex>` 形式。クライアントが解説生成時に渡し戻す |
| `title` | string | 13字以内・現代日本語 |
| `body` | string | 400〜600字目標（hard min 300 / hard max 800） |
| `tags` | object | リクエストの echo（クライアントが解説で再送する手間を省く） |
| `meta` | object | 観測用。フロント未使用でも返す |

#### Response 400 Bad Request

```json
{ "error": "invalid_vocab", "message": "tags.stage must be one of: 学校・施設, 水辺・井戸・海, 山・峠・トンネル" }
```

#### Response 200 + fallback（内部障害時）

```json
{
  "id": "stry_fallback_xxxx",
  "title": "井戸を覗くな",
  "body": "（fallback 固定文 — 後述§5）",
  "tags": { ... },
  "meta": { "model": "fallback", "elapsedMs": 0, "fallbackReason": "claude_timeout" }
}
```

`x-yotogi-fallback: true` をレスポンスヘッダに付ける。フロントは 200 として通常通り描画する。

---

### 1.2 `POST /api/generate-folklore`

生成された怪談に対して、民俗学解説（3セクション固定見出し）を返す。

#### Request

```http
POST /api/generate-folklore
Content-Type: application/json

{
  "story": {
    "title": "井戸を覗くな",
    "body": "（怪談本文）"
  },
  "tags": {
    "stage": "水辺・井戸・海",
    "being": "女の霊・悪霊",
    "attribute": "呪い・祟り"
  }
}
```

| key | 型 | 必須 | 説明 |
|---|---|---|---|
| `story.title` | string | yes | 13字以内 |
| `story.body` | string | yes | 200〜1500字。短すぎ・長すぎは 400 |
| `tags` | object | yes | `/generate-story` と同形 |

#### Response 200 OK

```json
{
  "id": "fol_2026-06-13T07-22-30Z_c3d4",
  "sections": {
    "denshou":   "井戸の底に女霊・子の霊が宿るという話形は、東日本「井戸女」、西日本「井戸の子守」として広く採録される。柳田國男『遠野物語』第六十話に近い類例がある。",
    "butai":     "井戸は古来「他界との通路」とされ、水鏡に他者の姿が映る場として畏怖された。「覗いてはいけない」は水源を清浄に保つ実利的戒律と異界接触への恐れが折り重なる。",
    "motif":     "「水辺・井戸・海」「女の霊・悪霊」「呪い・祟り」。戦前の民俗誌に頻出する組み合わせで、水神信仰の負の側面を構成している。"
  },
  "meta": {
    "draftModel":    "claude-3-5-haiku-latest",
    "verifyModel":   "claude-3-5-sonnet-latest",
    "grade":         5,
    "revised":       false,
    "elapsedMs":     11240,
    "totalChars":    372
  }
}
```

**セクション key と見出しの対応（フロント側で固定文言を被せる）**

| key | フロント表示の固定見出し | 字数目安 |
|---|---|---|
| `denshou` | `【伝承の型】` | 100–180 字 |
| `butai`   | `【舞台の意味】` | 100–180 字 |
| `motif`   | `【あなたが選んだモチーフ】` | 80–140 字 |

**LLM が返すのは「見出しを取り除いた本文だけ」**。フロントが `【伝承の型】` 等を頭につけて描画する。プロンプトでこの分離を強制する（§3.2 参照）。

`meta.grade` は検証ゲートが付けた 1–5 の採点。`meta.revised` は再生成が走ったか。

#### Response 400 / Fallback

`/generate-story` と同じパターン。fallback 解説は §5 の固定文。

---

## 2. プロンプト組み立て

### 2.1 怪談生成プロンプト

`/root/yotogi/GENERATION_PROMPT.md` のテンプレートを **そのまま使う**。`{tags}` と `{refs}` を差し込む。

**`{tags}` 差し込み形式**:

```
- 舞台: 水辺・井戸・海
- 存在: 女の霊・悪霊
- 属性: 呪い・祟り
```

**`{refs}` 差し込み形式（RAG 結果 3 件）**:

```
[参考1] 「井戸の女」(田中貢太郎): その井戸の縁に、白い襦袢の女が…（300字前後抜粋）

[参考2] 「八尺様」(ネット怪談): …（300字前後抜粋）

[参考3] 「水底の声」(小泉八雲): …（300字前後抜粋）
```

抜粋は `bodyText` の **先頭 300 文字**。それ以上は不要（プロンプト膨張回避）。

### 2.2 解説プロンプト

#### ドラフト（haiku）プロンプト雛形

```
あなたは民俗学の知識を持つ「注釈者」です。以下の怪談に対し、3セクションの解説を書いてください。

# 怪談
タイトル: {title}
本文: {body}

# ユーザーが選んだ3要素
- 舞台: {stage}
- 存在: {being}
- 属性: {attribute}

# 出力ルール（厳守）
- 3セクションを JSON で返す（後述）
- 各セクション本文のみ。見出し【伝承の型】等は付けない（フロントが付ける）
- セクション1（denshou）: 100–180字。話形（モチーフが指す類話）の地理分布、収録文献の例。柳田國男・折口信夫・池田弥三郎などの実在の民俗学資料を可能なら引く
- セクション2（butai）: 100–180字。選ばれた「舞台」の民俗的意味、禁忌の由来
- セクション3（motif）: 80–140字。ユーザーが選んだ3要素を読み返してまとめる。「水神信仰の負の側面を構成している」のような構造分析で締める

# トーン
- です・ます調の静かな解説体
- 断定回避。「〜とされる」「一つの見方だが」を使う
- 留保は出所明示とセットにする
- 箇条書き禁止、太字禁止、「結論」「まとめ」「参考文献はこちら」禁止
- AI調/翻訳調禁止

# 捏造防止（最重要）
1. AT/ATU話型番号は確信時のみ正確に書く。曖昧なら番号に触れず「見るな型の禁忌譚」と記述で済ます
2. 学説は誰の議論か特定（柳田國男・折口信夫・関敬吾等）。特定できなければ「学界の合意」のように書かず「一つの見方／筆者の解釈」と明示
3. ジャンル峻別（記紀神話／伝説／昔話を一括りにしない）
4. 呼称の標準性を区別（「見るなの座敷」=広く使う／「禁室譚」=論者依存）
5. 時代層の異なる信仰を並列しない（古代の鏡＝依代 と 近代の写真＝魂を抜かれる俗信を「古い信仰」で一括しない）
6. 出典名は正確に。説話集（『遠野物語』）を学説の根拠として引かない

# 出力形式
以下の JSON のみ返す。前後に説明文・コードフェンス禁止。
{"denshou": "...", "butai": "...", "motif": "..."}
```

#### 検証（sonnet）プロンプト雛形

```
あなたは民俗学の監修者です。以下の解説ドラフトを審査してください。

# 怪談（参考）
タイトル: {title}
本文: {body}

# ユーザーが選んだ3要素
- 舞台: {stage}
- 存在: {being}
- 属性: {attribute}

# ドラフト
{"denshou": "...", "butai": "...", "motif": "..."}

# 審査項目
- accurate: 民俗学的に致命的な捏造・誤りが無い (true/false)
- grade: 1-5（4以上で合格）。基準は (a) 該当する民俗概念に正しく接続している (b) 留保表現が出所明示とセット (c) ジャンル混同なし (d) 時代層混同なし (e) AT/ATU 番号の濫用なし
- violations: 違反項目のリスト（"AT番号の曖昧使用", "ジャンル混同", "学説の独自解釈通説化", ...）

# 行動
- accurate=true かつ grade>=4 かつ violations=[] → ドラフトをそのまま `sections` として返す
- 不合格 → あなた自身が同じ JSON 形式で「修正版」を書き直して `sections` に入れる。修正は「留保化・典拠明示・番号削除」の方向で

# 出力形式
JSON のみ。前後に説明文・コードフェンス禁止。
{
  "accurate": true,
  "grade": 5,
  "violations": [],
  "sections": {"denshou": "...", "butai": "...", "motif": "..."}
}
```

実装側は **`sections` だけをそのままフロントに返せばよい**（合格でも不合格でも sonnet が `sections` を作る）。`accurate` / `grade` / `violations` は `meta` にログ目的で残す。

---

## 3. RAG（参照怪談3件抽出）ロジック

ベクトル検索や事前タグ付けは **しない**。コーパスは `/root/yotogi/data/corpus.json` の 2420 件を `fs.readFile` でメモリに乗せ、以下のキーワード一致で抽出する。

### 3.1 タグ → 検索語マッピング（ハードコード）

API ルートのコード内に直書きする静的辞書。

```ts
const TAG_KEYWORDS: Record<string, string[]> = {
  // 舞台
  "学校・施設":     ["学校", "教室", "校舎", "保健室", "体育館", "病院"],
  "水辺・井戸・海": ["井戸", "海", "川", "池", "沼", "水"],
  "山・峠・トンネル": ["山", "峠", "トンネル", "森"],
  // 存在
  "女の霊・悪霊":   ["女", "霊", "幽霊", "怨霊"],
  "子ども・赤子の霊": ["子ども", "子供", "赤子", "赤ん坊", "童"],
  "異形・正体不明": ["異形", "化け", "もの", "影"],
  // 属性
  "呪い・祟り":     ["呪い", "祟", "障り", "因縁"],
  "錯乱（見えなくなる）": ["消え", "見えな", "気が", "狂"],
  "神隠し・行方不明": ["神隠し", "行方", "失踪", "消えた"],
};
```

> v1 ではこの素朴な辞書で十分。v2 で LLM タグ付けに置き換える余地は残すが、MVP では触らない。

### 3.2 抽出アルゴリズム

```ts
function pickRefs(corpus, stage, being, attribute, k = 3): Story[] {
  const allKw = [stage, being, attribute].flatMap(t => TAG_KEYWORDS[t]);
  // 各話のスコア = bodyText に含まれるキーワード種類数（出現回数ではなく種類数）
  const scored = corpus
    .map(s => {
      const score = allKw.filter(kw => s.bodyText.includes(kw)).length;
      return { story: s, score };
    })
    .filter(x => x.score >= 2)        // 最低2種ヒット必須
    .sort((a, b) => b.score - a.score);

  // 上位 30 件からランダム3件（毎回違う参照になるように）
  const pool = scored.slice(0, 30);
  return shuffle(pool).slice(0, k).map(x => x.story);
}
```

**ヒット 3 件未満の場合の fallback**: スコア閾値を下げて1種ヒット以上で再検索。それでも足りなければ `corpus` からランダム3件。

### 3.3 抜粋作成

```ts
function makeRefBlock(refs: Story[]): string {
  return refs.map((s, i) =>
    `[参考${i+1}] 「${s.title}」(${s.author ?? s.system}): ${s.bodyText.slice(0, 300)}…`
  ).join("\n\n");
}
```

---

## 4. 実装スケルトン（Next.js App Router / Route Handler）

### 4.1 ファイル配置

```
web/
├── src/
│   ├── app/
│   │   └── api/
│   │       ├── generate-story/
│   │       │   └── route.ts
│   │       └── generate-folklore/
│   │           └── route.ts
│   └── lib/
│       ├── anthropic.ts        # Claude SDK ラッパ
│       ├── corpus.ts           # corpus.json ローダ（モジュールスコープでキャッシュ）
│       ├── rag.ts              # pickRefs + makeRefBlock
│       ├── prompts.ts          # プロンプト雛形（GENERATION_PROMPT.md / FOLKLORE_COMMENTARY.md を文字列化）
│       ├── vocab.ts            # VOCAB と TAG_KEYWORDS
│       ├── validate.ts         # zod スキーマ + 字数チェック
│       └── fallback.ts         # 固定 fallback 怪談 / 解説
├── data/  -> /root/yotogi/data/ への symlink もしくはビルド時コピー
└── .env.local
    ANTHROPIC_API_KEY=sk-ant-...
```

> `data/corpus.json` は web/ ディレクトリ配下から読める必要がある。`process.cwd()` から `../data/corpus.json` を読むか、ビルドステップで `web/data/` にコピーする。**ビルド時コピー推奨**（Vercel デプロイでサブモジュールが面倒）。`web/scripts/copy-corpus.mjs` を追加し `package.json` の `prebuild` で実行。

### 4.2 依存関係追加

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "zod": "^3.23.0"
  }
}
```

### 4.3 `route.ts` の骨格（generate-story）

```ts
// app/api/generate-story/route.ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { loadCorpus } from "@/lib/corpus";
import { pickRefs, makeRefBlock } from "@/lib/rag";
import { storyPrompt } from "@/lib/prompts";
import { claude } from "@/lib/anthropic";
import { fallbackStory } from "@/lib/fallback";
import { VOCAB } from "@/lib/vocab";

export const runtime = "nodejs";
export const maxDuration = 30; // Vercel function timeout

const Body = z.object({
  tags: z.object({
    stage:     z.enum(VOCAB.stage),
    being:     z.enum(VOCAB.being),
    attribute: z.enum(VOCAB.attribute),
  }),
});

export async function POST(req: Request) {
  const t0 = Date.now();
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_vocab", message: parsed.error.message },
      { status: 400 }
    );
  }
  const { tags } = parsed.data;

  try {
    const corpus = await loadCorpus();
    const refs = pickRefs(corpus, tags.stage, tags.being, tags.attribute, 3);
    const prompt = storyPrompt({
      tags: `- 舞台: ${tags.stage}\n- 存在: ${tags.being}\n- 属性: ${tags.attribute}`,
      refs: makeRefBlock(refs),
    });

    const raw = await claude.complete({
      model: "claude-3-5-sonnet-latest",
      maxTokens: 1500,
      system: "あなたは現代の実話怪談を書く作家です。",
      user: prompt,
      timeoutMs: 25_000,
    });

    const { title, body } = parseStoryOutput(raw);
    validateStory(title, body); // 字数チェック・旧仮名 regex

    return NextResponse.json({
      id: `stry_${new Date().toISOString().replace(/[:.]/g,"-")}_${rand4()}`,
      title, body, tags,
      meta: {
        model: "claude-3-5-sonnet-latest",
        elapsedMs: Date.now() - t0,
        bodyChars: body.length,
        titleChars: title.length,
      },
    });
  } catch (e) {
    const fb = fallbackStory(tags);
    return new NextResponse(JSON.stringify({
      ...fb,
      meta: { model: "fallback", elapsedMs: Date.now()-t0, fallbackReason: String(e).slice(0,200) },
    }), {
      status: 200,
      headers: { "Content-Type": "application/json", "x-yotogi-fallback": "true" },
    });
  }
}
```

### 4.4 怪談出力パース

LLM 出力の想定形式（GENERATION_PROMPT.md 通り）:

```
井戸を覗くな
その井戸は、村のいちばん奥にあった。…（本文）
```

パース規則:
1. 先頭非空行をタイトル候補とする
2. 2行目以降を本文とする（空行は1個に圧縮）
3. `</story>` 等のタグ漏れは正規表現で除去（`/<\/?(story|title|body)>/gi`）
4. タイトル末尾の `」` 等装飾は許容（剥がさない）
5. 本文末の `※` で始まる注釈は除去

### 4.5 字数 / 旧仮名チェック

```ts
const OLD_KANA = /[ゐゑヰヱ]|候$|なりけり|たりけり|べし$/;

function validateStory(title: string, body: string) {
  if (title.length > 13) throw new Error("title_too_long");
  if (body.length < 300 || body.length > 800) throw new Error("body_length_out_of_range");
  if (OLD_KANA.test(body)) throw new Error("old_kana_detected");
}
```

失敗時は **1 回だけ再生成試行** → それでも失敗なら fallback。

### 4.6 解説の2段ゲート実装

```ts
// 1) draft
const draft = await claude.complete({
  model: "claude-3-5-haiku-latest",
  user: folkloreDraftPrompt({title, body, tags}),
  maxTokens: 1200,
});
const draftJson = JSON.parse(draft);

// 2) verify
const verify = await claude.complete({
  model: "claude-3-5-sonnet-latest",
  user: folkloreVerifyPrompt({title, body, tags, draft: draftJson}),
  maxTokens: 1500,
});
const verified = JSON.parse(verify);

// verified.sections を採用（合格でも修正版でも sonnet が sections を返す）
return verified.sections;
```

JSON.parse 失敗時は **fallback 解説**。retry は1回まで。

---

## 5. Fallback 固定文

API 内部で例外が出ても **絶対に 500 を返さない**。下記の固定値を返す。フロントは `x-yotogi-fallback` で気づけば warning を出してもよいが、画面は通常通り描画する。

### 5.1 Fallback 怪談（タグ非依存・1パターン）

```json
{
  "id": "stry_fallback_0001",
  "title": "井戸を覗くな",
  "body": "その井戸は、村のいちばん奥にあった。誰も水を汲まないのに、夜になると底から、子どもの声がした。「覗いてはいけない」と祖母は言った。覗いた者は、次の夏には居なくなる。けれど私は、声の主が知りたかった。縁に手をかけ、暗い水面を見下ろす。そこに、白い顔がひとつ。それは、私を見上げて、たしかに笑った。家に帰ると、母が私の名を呼んだ。けれど、私の名前は、その夏から呼ばれなくなった。"
}
```

### 5.2 Fallback 解説

```json
{
  "sections": {
    "denshou": "井戸の底に女霊・子の霊が宿るという話形は、東日本「井戸女」、西日本「井戸の子守」として広く採録される。柳田國男『遠野物語』第六十話に近い類例がある。",
    "butai": "井戸は古来「他界との通路」とされ、水鏡に他者の姿が映る場として畏怖された。「覗いてはいけない」は水源を清浄に保つ実利的戒律と異界接触への恐れが折り重なる。",
    "motif": "「水辺・井戸・海」「女の霊・悪霊」。戦前の民俗誌に頻出する組み合わせで、水神信仰の負の側面を構成している。"
  }
}
```

---

## 6. 環境変数

```
ANTHROPIC_API_KEY=sk-ant-xxx          # 必須
YOTOGI_LLM_TIMEOUT_MS=25000           # 任意。デフォ 25s
YOTOGI_RAG_POOL_SIZE=30               # 任意。RAG 上位プール
YOTOGI_LOG_LEVEL=info                 # info/debug
```

Vercel の Environment Variables に登録。`.env.local` は git に含めない。

---

## 7. 観測 / ロギング

最低限の `console.log` で OK。各リクエストで:

```
[story] tags={...} refs=3 model=sonnet elapsed=6420ms bodyChars=487 ok
[story] tags={...} fallback reason=claude_timeout elapsed=25001ms
[folklore] grade=5 revised=false draft=320c verified=372c elapsed=11240ms ok
```

将来 Sentry / Datadog に流すための JSON 構造化ログにしておくとなお良いが、v1 では plain で可。

---

## 8. フロント側で必要な改修（参考・別作業）

| 画面 | 改修 |
|---|---|
| `/motif` (MotifSelection) | 「怪談を作る」CTA から `POST /api/generate-story` を呼び、レスポンス JSON を sessionStorage に格納 → `/generating?next=story` へ |
| `/generating?next=story` | dawn-4 完了時に sessionStorage を読んで `/story` へ replace |
| `/story` | sessionStorage から `{title, body, tags}` を取り出して描画。「解説を作成」押下で `POST /api/generate-folklore` → sessionStorage に解説保存 → `/generating?next=folklore` |
| `/folklore` | sessionStorage から `{sections, title}` を取り出して描画。見出し【伝承の型】等はフロント側で固定文字列を被せる |

sessionStorage キー:
- `yotogi.story.v1` → `{ id, title, body, tags }`
- `yotogi.folklore.v1` → `{ id, sections }`

> 状態管理は **sessionStorage で十分**。URL に乗せる必要はない（OGP 共有は v1 では捨てる。DECISION.md の OGP 動線は v2）。

---

## 9. v2 以降の余地（書き残し）

- ストリーミングレスポンス（SSE）で本文を順次返し、dawn-4 と同時に「文字が浮かび上がる」演出を可能にする
- LLM タグ付けスクリプトで `corpus.json` に `tags[]` を持たせて RAG 精度を上げる（埋め込み検索より先にこれ）
- ユーザー履歴の保存（DB 追加）→ MVP では持たない
- 怪談本文の自己採点ループ（GENERATION_PROMPT.md の「自己採点<4で再生成」）→ v1 ではコスト優先で省略

---

**END OF SPEC**
