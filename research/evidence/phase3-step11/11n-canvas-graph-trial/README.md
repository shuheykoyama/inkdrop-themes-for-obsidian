# Canvas・Graph View の配色の試験実装（2026-11-02、撮影なし）

[14](../../../14-implementation-plan.md) §6.170 の証拠。**製品の CSS（`src/`・`dist/`）、検査の仕様、ゲートの入力は変えていない。** 試験の変更は、`7e74b5f` の隔離クローン（スクラッチ）だけで行った。`trial.patch` がその差分。正式な統合は、画像を含む独立レビューのあとに判断する。

## 試験の変更（`trial.patch`）

- 新しい `src/common/mapping/canvas-graph.css`（両テーマの入口の、`platform/mobile.css` の次に `@import`）:
  - `.theme-dark { --canvas-color-1..6, --canvas-dot-pattern, --graph-line, --graph-node-tag, --graph-node-attachment }`。
  - `.theme-dark:is(body) { --canvas-color }`。
- `tests/spec/runtime/desktop.json` に 11 件の `kind: "var"` の検査、`tests/spec/requirements.json` に `ui.canvas-graph`（`mandatory: false`、Obsidian 固有で Inkdrop に対応がないので、変数を確かめるだけで見た目は確かめない）。
- `--color-red` などの共通の色の変数、`-rgb`、`--color-base-*` は触れていない。

| 変数 | 値（両テーマ共通の変数名） |
|---|---|
| `--canvas-color-1`〜`6` | `--ink-red`・`--ink-orange`・`--ink-yellow`・`--ink-green`・`--ink-teal`・`--ink-violet` |
| `--canvas-color`（色なしのノードの枠とエッジ） | `--ink-disabled-text-color` |
| `--canvas-dot-pattern` | `--ink-solid-border-color` |
| `--graph-line` | `--ink-strong-border-color` |
| `--graph-node-tag`・`--graph-node-attachment` | `--ink-green`・`--ink-yellow` |

## Obsidian 1.14.5 の `app.css`（`app-css-1.14.5-refs.txt`）

asar（SHA-256 `3a349274…`）から抽出した `app.css`（SHA-256 `866e50ac…`）の行番号付き。

- `--canvas-color-1..6` は `var(--color-red)` などを参照する（**`-rgb` ではない**。古いコピーの `-rgb` の参照は 1.14.5 には当てはまらない）。`--canvas-dot-pattern: var(--color-base-30)`、`--graph-line: var(--color-base-35, var(--background-modifier-border-focus))`、`--graph-node-tag: var(--color-green)`、`--graph-node-attachment: var(--color-yellow)`。いずれも `body {`（詳細度 (0,0,1)）で定義される。`.theme-dark`（(0,1,0)）で上書きできる。
- `--canvas-color` は `body { #c0c0c0 }` と `body.theme-dark { #7e7e7e }`（(0,1,1)）。`.mod-canvas-color-N { --canvas-color: var(--canvas-color-N) }`（(0,1,0)）が、色付きのノードの要素で上書きする。`.theme-dark` では勝てないので、`.theme-dark:is(body)`（`:is(body)` の詳細度は body の (0,0,1)、合計 (0,1,1)）で同じ詳細度にし、あとに読み込まれる順で勝たせた。`body.theme-dark` と書かないのは、静的検査 S4（全部の規則が `.theme-dark` の下）による。
- `--canvas-color` は 25 の規則が参照する（枠、エッジ、選択の輪、ラベルなど）。`--canvas-color-N` は 1 つの規則（`.mod-canvas-color-N`）しか参照しない。

## 結果

- **変数**（`compare.txt`）: 379 変数を前後で比べて、変わったのは設計した 11 変数だけ（SD・KD とも）。テーマなしの条件は 0 変数が違う（試験のビルドが読み込まれない）。
- **Graph の描画の色**: 変わったのは `fillTag`（緑）・`fillAttachment`（黄）・`line` の 3 つだけ。ほかの 8 つは同じ。
- **既存の実行時の検査**（1.14.5 E39.5.1、`runtime.json` は大きいので保存せず、`compare-runtime.txt` に要約）: 3915 件、FAIL 0。基準（`5a9e5b1` の回帰の run1）と、同じ 3871 件の状態の変化は 0。増えた 44 件は、新しい 22 件の検査 × 2 テーマ（不透明と、translucent のあとの不透明の 2 回）で、すべて PASS。DIFF 576・UNSUPPORTED 30・PASS (EMULATED) 820 は同じ。SD の次に KD を測っても、新しい検査は KD の値で PASS（変数の残留はない）。
- **新しい検査の検出力**（`mutant-check.txt`）: CSS がない最終ビルドでは、11 変数のうち期待のトークンと同じものは 0（SD・KD とも）。試験のビルドでは 11 / 11。つまり、CSS が当たっていなければ、新しい検査はすべて FAIL する。
- **静的検査**: 試験のクローンで `node tests/static/run.mjs` が全部通る（S4・S5 の stylelint を含む。`no-descending-specificity` のため、入口の最後（`platform` の次、テーマ固有の例外の前）に置いた）。
- **ほかの UI への波及**（要素の色の比較）: Callout・タグ・Mermaid・警告・ボタンの色は、379 変数の比較で動いていない（`--color-*` を触らなかったため）。要素の比較の差は、Canvas の対象の要素（枠、エッジ、ノードの色）と、Properties・Bases・右ドックの要素のうち、この試験の変数を使わない要素の状態の違い（フォーカスの輪、アクティブな見出しの色）だった。後者は 2 回の測定の間の状態の違いで、この試験の変数とは関係しない（`compare.txt`）。

## 視認性の予測（Computed Style から。画像で確かめるまで確定しない）

エディタの背景（SD `rgb(0, 33, 41)`、KD `rgb(30, 29, 26)`）に対する WCAG のコントラスト比（alpha は合成）:

| 対象 | Obsidian の既定 | SD の試験 | KD の試験 |
|---|---|---|---|
| 色なしのノードの枠・エッジ | 4.14（`#7e7e7e`） | 2.55 | 2.11 |
| ドットの背景 | 1.33（`#333`） | 1.28 | 1.46 |
| Graph の線 | 1.60（`#3f3f3f`） | 1.29 | 1.74 |
| タグのノード | — | 5.24 | 5.54 |
| 添付のノード | — | 5.06 | 8.00 |
| 色 1〜6 | — | 3.62〜6.75 | 4.87〜8.00 |

- 色なしのノードと色付きのノードは区別できる見込み（CIEDE2000: SD 25〜40、KD 29〜40）。色同士のいちばん近い組は、SD が色 1 と 2（赤と橙、10.3）、KD が色 4 と 5（緑とシアン、12.3）で、やや近い。
- **SD の Graph の線**は、既定より薄い（1.29 対 1.60）。見えにくくなるおそれがある。KD は既定に近い。画像で確認し、薄ければ `--ink-solid-border-color` や `--ink-disabled-text-color` などに替える。
- 色なしのノードの枠・エッジは、既定より静かになる（4.1 → 2.1〜2.6）。色付きとの区別は保てるが、エッジが背景に埋もれないかを画像で確かめる。

## 撮影が必要な画面（ユーザーの許可のあと）

隔離した Obsidian で、両テーマ、変更前後を並べる（8 枚）:

1. Canvas 全体: 色なしのノード、色 1〜6 のノード、`#ff8800` のノード、ファイルのノード、グループ、エッジ 2 本（1 本は色付き）、ドットの背景。
2. Canvas のノードを選択した状態（選択の輪は `--canvas-color` を使う）。
3. Graph View 全体: 通常のノード、タグのノード、添付のノード、線、フォーカスしたノード、未解決のノード。
4. 文字の視認性: ノードの中の文字とラベル。

## 確かめていないこと

- 画素。Canvas と Graph の実際の見た目は未確認（Graph の描画は `renderer.colors` を読んだもの）。
- hover・選択・ドラッグの状態、translucent、popout、モバイル、1.14.4 と E43、iPhone。
- 正式な統合に伴う、ほかの検査（自己テスト、`tests/integration` の回帰、4 環境）。
