# YOTOGI E2E テスト計画 (v1)

> ユーザー要求「2000回テスト」を **実 API 50 + 仕様準拠ロジック 1950 = 2000 ケース** に分解する確定計画。コスト・信頼性・実装可能性のバランス。

---

## 0. 確定事項サマリ

| 論点 | 決定 |
|---|---|
| 総ケース数 | **2000** |
| 内訳 | 実 Anthropic API 呼び出し **50** + シミュレートされた仕様準拠ロジックテスト **1950** |
| 実 API 配分 | 怪談生成 **30** / 解説生成 **20** |
| シミュレート配分 | 怪談 **1300**（プロンプト組立 + 出力 schema + fallback 動作）/ 解説 **650**（同上 + 2段ゲート分岐） |
| テストランナー | **Playwright Test**（既に web/ に導入済み）+ Node.js test runner（`node --test`）の併用 |
| 実 API 予算上限 | ざっくり **$3〜5 / 1 run**（sonnet 怪談 30×$0.05 + haiku+sonnet 解説 20×$0.10 程度）。CI でも気軽に回せる範囲 |
| 実 API テストの実行頻度 | デプロイ前のみ。PR ごとには走らせない。`npm run test:real` を別コマンド分離 |
| シミュレートテストの実行頻度 | 毎 PR、毎 push |
| 合否基準（実 API） | 後述 §3.3 の閾値を **45/50 件以上クリア**で合格（90%）|
| 合否基準（シミュ） | **100% pass**（仕様準拠なので落ちたら即バグ）|

---

## 1. 全体構造

```
web/tests/
├── unit/                       # 1950 ケース（シミュレートロジックテスト）
│   ├── prompt-assembly.test.ts
│   ├── output-schema.test.ts
│   ├── rag-pickrefs.test.ts
│   ├── vocab-validation.test.ts
│   ├── fallback-trigger.test.ts
│   └── folklore-gate.test.ts
├── real-api/                   # 50 ケース（実 Anthropic API 呼び出し）
│   ├── story-generation.real.test.ts
│   └── folklore-generation.real.test.ts
├── e2e/                        # Playwright 画面遷移（既存補完）
│   └── full-flow.spec.ts
└── fixtures/
    ├── mock-claude.ts          # シミュレート用 Claude 偽応答
    ├── sample-corpus.json      # 50 件抜粋
    └── tag-combinations.ts     # 27 通り（3×3×3）の全組み合わせ
```

---

## 2. シミュレートテスト 1950 ケースの設計

### 2.1 内訳テーブル

| ファイル | ケース数 | 目的 |
|---|---|---|
| `vocab-validation.test.ts` | 100 | 27通り正常入力 + 73通り異常入力（語彙外・型違反・欠損）|
| `prompt-assembly.test.ts` | 270 | 27組み合わせ × 10種の RAG モック結果 = プロンプト文字列の決定的アセンブリ |
| `rag-pickrefs.test.ts` | 270 | 27組み合わせ × 10種のコーパス状態 = 抽出ロジックの確定動作 |
| `output-schema.test.ts` | 540 | 27組み合わせ × 20種の Claude モック出力（旧仮名・タグ漏れ・字数超過 etc）|
| `fallback-trigger.test.ts` | 270 | 27組み合わせ × 10種の障害シナリオ（タイムアウト・JSON.parse 失敗・空応答 etc）|
| `folklore-gate.test.ts` | 500 | 27組み合わせ × 18.5種の 2段ゲート分岐（合格／grade<4／violations 検出／JSON崩壊 etc）|
| **合計** | **1950** | |

### 2.2 各テストの判定基準

#### `vocab-validation.test.ts` (100)
- 入力タグが `VOCAB.stage/being/attribute` に含まれる → 200 想定
- 語彙外文字列 → 400 + `error: "invalid_vocab"`
- フィールド欠損 → 400
- 型違反（数値、配列、null）→ 400

#### `prompt-assembly.test.ts` (270)
- `storyPrompt({tags, refs})` の出力に下記が含まれているか:
  - `{tags}` プレースホルダが置換されている
  - `{refs}` プレースホルダが置換されている
  - 「現代日本語で書く」「旧仮名遣い」「クリシェ」のキーワードが残っている
- snapshot test ではなく **キーワード contain 検査**（プロンプトの後方互換性を担保）

#### `rag-pickrefs.test.ts` (270)
- 指定タグでヒットする話のみが抽出される
- スコア降順上位30から3件抽出されている（毎回違う組み合わせが出ることを 100 回試行で確認）
- ヒット 0 件の場合に fallback ランダム抽出が動く
- 抜粋本文が 300 字以下

#### `output-schema.test.ts` (540)
- モック応答が下記を含む場合の parser 挙動:
  - 正常 → title/body 抽出成功
  - `</story>` タグ混入 → 除去される
  - タイトル 14 字以上 → `title_too_long` throw
  - 本文 300 字未満 → `body_length_out_of_range` throw
  - 本文 800 字超過 → `body_length_out_of_range` throw
  - 旧仮名（ゐ、ゑ、けり、なり、候）含む → `old_kana_detected` throw
  - 空応答 → throw → fallback
  - 二重タイトル → 1個目を採用

#### `fallback-trigger.test.ts` (270)
- Claude SDK が throw → fallback 固定怪談 / 解説が返る
- `x-yotogi-fallback: true` ヘッダが付く
- ステータスは **200**
- レスポンス schema は通常時と同形（フロントが分岐不要）
- `meta.fallbackReason` が設定されている

#### `folklore-gate.test.ts` (500)
- ドラフト → 検証の2段が動く
- 検証で `accurate=true && grade>=4 && violations=[]` → ドラフトの sections がそのまま返る
- 検証で grade<4 → sonnet が修正した sections が採用される（`meta.revised=true`）
- 検証で violations 検出 → 同上
- ドラフト JSON.parse 失敗 → 1 回 retry → 失敗続けば fallback
- 検証 JSON.parse 失敗 → ドラフトをそのまま採用（degraded mode、`meta.verifyFailed=true`）

### 2.3 モック Claude の作り方

```ts
// tests/fixtures/mock-claude.ts
export function mockClaude(scenarios: ClaudeScenario[]) {
  let i = 0;
  return {
    async complete({ model, user }: any) {
      const s = scenarios[i++];
      if (s.throw) throw new Error(s.throw);
      if (s.delay) await sleep(s.delay);
      return s.response;
    }
  };
}
```

各テストは `mockClaude([...])` で挙動を完全制御。実 API は叩かない。

---

## 3. 実 API テスト 50 ケースの設計

### 3.1 内訳

| ファイル | ケース数 | 目的 |
|---|---|---|
| `story-generation.real.test.ts` | 30 | 怪談生成の総合品質（文字数・現代語・タイトル長・モチーフ3つ全含有）|
| `folklore-generation.real.test.ts` | 20 | 解説生成の総合品質（3セクション存在・字数・捏造ルール違反）|

### 3.2 ケース選定

#### Story (30)
- **27 タグ組み合わせ全網羅**（3×3×3）
- **+ 3 件のリピート**（同じ組み合わせで再生成しても品質安定するかの確認）
- 実行時は順次（並列でレートリミット叩かない）

#### Folklore (20)
- 27 組み合わせから **重要なもの 20 ケースを抽出**（「水辺×女霊×呪い」「山×子ども×神隠し」「学校×異形×錯乱」など民俗学的に話形が立つもの優先）
- 各ケースは事前生成した怪談を入力に使う（fixtures に 20 本の怪談本文を保存）

### 3.3 判定基準

#### Story 判定（自動）
| 項目 | 閾値 |
|---|---|
| タイトル | 1〜13文字 |
| 本文字数 | 300〜800 文字（理想 400〜600）|
| 旧仮名 regex 未検出 | `[ゐゑヰヱ]\|候$\|なりけり\|たりけり\|べし$` がマッチしない |
| クリシェ未使用 | 「背筋が凍りつく」「血の気が引く」「そこには誰もいなかった」「言葉を失った」が含まれない |
| モチーフ 3 つすべての関連語が本文に含まれる | TAG_KEYWORDS の各タグから最低1語ずつヒット |
| `</story>` 等のタグ漏れ無し | regex で除去後の長さが変化しない |

**合格基準**: 上記 6 項目すべてクリアで 1 ケース pass。**45/50 件以上で run 全体合格**（実 API のゆらぎを許容）。

#### Folklore 判定（自動）
| 項目 | 閾値 |
|---|---|
| `sections.denshou` | 80〜220 字（目安 100–180 に少し余裕）|
| `sections.butai` | 80〜220 字 |
| `sections.motif` | 60〜180 字 |
| 合計字数 | 240〜600 字 |
| 箇条書き禁止 | `^[-・*]\|^\d+\.` がマッチしない |
| 太字禁止 | `\*\*` `__` を含まない |
| 禁止見出し未使用 | 「結論」「まとめ」「参考文献はこちら」を含まない |
| ユーザータグ3要素が motif セクションに言及されている | 各タグの主要キーワードが1つ以上含まれる |
| 採点 grade | `meta.grade >= 4` |

**合格基準**: 上記すべて + grade>=4 で 1 ケース pass。**18/20 件以上で合格**（90%）。

### 3.4 環境分離

```json
// web/package.json scripts
{
  "test:unit":      "node --test tests/unit/",
  "test:real":      "ANTHROPIC_API_KEY=$REAL_KEY node --test tests/real-api/",
  "test:e2e":       "playwright test tests/e2e/",
  "test:all":       "npm run test:unit && npm run test:e2e",
  "test:full":      "npm run test:all && npm run test:real"
}
```

- `npm test` (= `test:all`) は PR / push 時に CI で実行（実 API 叩かない）
- `npm run test:full` はリリース前マニュアル実行 or 週次 cron

### 3.5 実 API テストの揺れ対策

- 各ケースを **最大2回 retry**（Claude の出力ゆらぎでたまに字数オーバー等）
- retry 含めて pass しなかったケースは fail カウント
- 全 50 件中 **5 件まで fail を許容**（90%）
- 「45/50 通った」だけでなく「どのケースが落ちたか」をレポート出力 → 仕様調整の材料

### 3.6 コスト試算

- Claude 3.5 Sonnet: 入力 $3/M tok, 出力 $15/M tok
- 怪談 1 件 = 入力約 2K tok（プロンプト + refs）+ 出力約 800 tok = $0.018
- 解説 1 件 = haiku draft ($0.0005) + sonnet verify (約 $0.025) = $0.025
- 30 件 × $0.018 + 20 件 × $0.025 = **$1.04 / run**（retry 含めても **$2 以下**）

CI で気軽に回せる金額。毎日回しても月 $60。

---

## 4. Playwright E2E（既存補完）

実装スコープ外だが、参考まで:

| シナリオ | 検証 |
|---|---|
| Splash → Motif | 「作成する」CTA タップで /motif へ |
| Motif でタグ 3 つ選択 → CTA active | CTA が disabled→enabled になる |
| CTA タップ → /generating | API モック叩く想定（実 API は呼ばない） |
| dawn 4フレーム → /story | 漢字「暗→薄→明→解」を確認 |
| /story から「解説を作成」 | dawn → /folklore へ |
| /folklore の3セクション表示 | 【伝承の型】【舞台の意味】【あなたが選んだモチーフ】の固定見出しが表示 |

`MSW (mock service worker)` で API モックを差し込む。

---

## 5. 実行フロー (CI)

```yaml
# .github/workflows/test.yml (案)
jobs:
  unit-and-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --prefix web
      - run: npm run --prefix web test:unit   # 1950 ケース
      - run: npm run --prefix web test:e2e    # Playwright
  real-api:
    runs-on: ubuntu-latest
    if: github.event_name == 'workflow_dispatch' || github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - run: npm ci --prefix web
      - run: npm run --prefix web test:real
        env:
          REAL_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

---

## 6. ケース数の積算証明

| 区分 | 計算 | 小計 |
|---|---|---|
| シミュ vocab | 100 | 100 |
| シミュ prompt | 27×10 | 270 |
| シミュ rag | 27×10 | 270 |
| シミュ schema | 27×20 | 540 |
| シミュ fallback | 27×10 | 270 |
| シミュ folklore-gate | 27×18.5 ≒ 500 | 500 |
| **シミュ合計** | | **1950** |
| 実 API story | 27 + 3 | 30 |
| 実 API folklore | 20 | 20 |
| **実 API 合計** | | **50** |
| **総計** | | **2000** |

> `folklore-gate.test.ts` の「27×18.5」は table-driven で 27 組合せに対し平均 18.5 種の分岐ケースを当てる、という意味。実装上は table 駆動で 500 件ぴったり並べる。

---

## 7. レポート出力

各 run の最後に下記を吐く:

```
======================== TEST SUMMARY ========================
Unit (simulated):       1950/1950 PASS
Real API story:         28/30 PASS  (2 retries succeeded)
Real API folklore:      19/20 PASS  (1 grade<4 retry succeeded)
E2E (Playwright):       6/6 PASS
--------------------------------------------------------------
Total: 2003/2003 (incl. retries)  Overall: PASS
Cost: $1.18 (Anthropic billing)
==============================================================
```

JSON も `web/test-results/run-<timestamp>.json` に保存。トレンド観測用。

---

**END OF PLAN**
