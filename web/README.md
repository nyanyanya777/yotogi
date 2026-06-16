# ネットロア フロント実装

YOTOGI（ネットロア）— 怪談を通じて民俗的記憶に触れるアプリ。
Next.js (App Router) + Tailwind CSS + TypeScript で構築。

実装仕様: `/root/YOTOGI_IMPLEMENTATION_SPEC.md`

## 起動

```bash
pnpm dev
```

（pnpm が無い場合は `npm run dev`）

## ビルド

```bash
pnpm build
```

## トークン

- カラー・タイポ・角Rは `src/app/globals.css` の `@theme` ブロックを単一の真実とする
- `tailwind.config.ts` は同じトークンをミラーしており、エディタや外部ツール向けの参照

## LLM 構成

YOTOGI は 3 層ハイブリッド LLM 構成をサポートする。`src/lib/llm.ts` が統一インターフェース (`LlmCall`) を提供し、`LLM_PROVIDER` 環境変数でフェーズごとのモデルを切り替える。

### provider モード

| `LLM_PROVIDER` | 怪談本文（story） | 解説ドラフト（draft） | 解説検証（verifier） |
|---|---|---|---|
| `anthropic`（既定） | Claude Sonnet 4.6 | Claude Sonnet 4.6 | Claude Sonnet 4.6 |
| `hybrid` | Claude Sonnet 4.6 | gemma3:27b（Ollama） | Claude Sonnet 4.6 |
| `local` | gemma3:27b（Ollama）※失敗時 Sonnet | gemma3:27b（Ollama）※失敗時 Sonnet | qwen2.5:32b（Ollama）※失敗時 Sonnet |
| `disabled` | 固定 fallback | 固定 fallback | 固定 fallback |

- `LLM_PROVIDER` 未設定で `ANTHROPIC_API_KEY` 有り → `anthropic` と等価。
- `LLM_PROVIDER` 未設定で `ANTHROPIC_API_KEY` 無し → `disabled` と等価。
- `hybrid` / `local` で Ollama へ接続できないとき、Anthropic キーがあれば Sonnet に自動フォールバック。両方とも使えなければルートは fixed fallback を返す。

### 環境変数

| 変数 | 既定 | 説明 |
|---|---|---|
| `LLM_PROVIDER` | unset（= anthropic or disabled） | provider モード切替 |
| `ANTHROPIC_API_KEY` | unset | Anthropic API キー。無い場合は fallback 経路 |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API ベース URL |
| `OLLAMA_DRAFT_MODEL` | `gemma3:27b` | ドラフト用 Ollama モデル名 |
| `OLLAMA_VERIFIER_MODEL` | `qwen2.5:32b` | local モード時の検証用モデル |
| `CORPUS_PATH` | `<repo>/data/corpus.json` | RAG コーパスの参照先 |

### 解説の 2 段ゲート

`POST /api/generate-folklore` は以下のゲートで品質を担保する。

1. **draft**: `callDraftModel` で生成。
2. **verify**: `callVerifierModel` がドラフトを審査し `{ accurate, grade, violations, revised? }` を返す。
3. ゲート判定（`decideFolklore`）：
   - `accurate=true && grade>=4 && violations 空` → draft をそのまま採用。
   - 上記を満たさず `revised` が正しい形 → revised を採用（1 回まで再生成）。
   - revised が無い／壊れている → 固定 fallback。
   - verify が JSON 不正で帰ってきた場合 → draft を採用（検証失敗扱い）。

レスポンスヘッダ：
- `x-yotogi-source`: `claude` / `fallback-no-key` / `fallback-error` / `fallback-gate-<reason>`
- `x-yotogi-stage`: 成功時 `draft` or `revised`

### Ollama のセットアップ（hybrid / local モード用）

```bash
# 1. Ollama 本体をインストール（Linux/macOS）
curl -fsSL https://ollama.com/install.sh | sh

# 2. モデルを pull
ollama pull gemma3:27b
ollama pull qwen2.5:32b   # local モードのみ必要

# 3. サーバ起動（既定 11434 ポート）
ollama serve

# 4. アプリ側
export LLM_PROVIDER=hybrid
export OLLAMA_BASE_URL=http://localhost:11434
export ANTHROPIC_API_KEY=sk-ant-...   # フォールバック用
npm run dev
```

Ollama を起動していない／到達できない場合でも、`ANTHROPIC_API_KEY` があれば自動的に Sonnet にフォールバックして処理は継続する。
