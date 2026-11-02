# Obsidian 固有 UI の Computed Style の実測（2026-11-02、撮影なし）

[14](../../../14-implementation-plan.md) §6.169 の証拠。製品の CSS、検査の判定、ゲートの入力は変えていない。撮影も、見た目の合格判定もしていない。

## 方法

- 隔離した Obsidian 1.14.5（Electron 39.5.1、インストーラ 1.11.7）。`tests/runtime/obsidian-isolated.sh` で、`tests/fixtures/vault` の複製だけを開いた。通常の Vault、同期、Inkdrop には触れていない。窓は約 94 秒開いて、閉じた（`window.txt`、終了後に隔離インスタンスが残っていないことを確認）。
- 調査用のノートは、複製の中だけに書いた（`probe.mjs` が作る）: Properties 用のノート（全型のプロパティ）、バックリンク用のノート、Canvas（色 1〜6、色コード、ファイル、グループ、エッジ 2 本）、Bases（table と cards）。
- 3 つの条件で測った（不透明）: テーマなし（Obsidian の既定の dark）、Solarized Dark、Kanagawa Dragon。
- 各 UI の要素のシグネチャごとに、color・背景・境界・fill・stroke を記録した（`probe.json`）。右ドックは Search（`probe` で検索）・Backlinks・Outline・Tags、Graph は `view.renderer.colors`（描画の色）と操作部の DOM。
- `analyze.mjs` が 3 条件を比べる。「テーマなしと同じ値で、テーマのパレット（`--ink-*`）にない色」を「既定が残る」、「テーマなしと違い、パレットにもない色」を「導出」と数える。パレットの最近傍は、不透明な色の CIEDE2000（alpha は無視した近似）。

## 結果（`analysis.txt`）

| UI | 結果 |
|---|---|
| Properties（Live Preview・Reading） | 見える色 15〜16 がすべてパレットの色。既定が残る・導出とも 0 |
| Bases（table・cards） | 見える色 7〜8 がすべてパレットの色。既定が残る・導出とも 0。`--bases-*` 77 変数のうち 16 がテーマの色に変わっている |
| 右ドック（Search・Backlinks・Outline・Tags） | すべてパレットの色。既定が残る・導出とも 0 |
| Graph View の操作部 | パレットの色だけ |
| Graph View の描画の色（`renderer.colors`） | ノード・フォーカス・文字・ハイライトは、テーマの色になる。**線（`#3f3f3f`）、タグのノード（緑 `#44cf6e`）、添付のノード（黄 `#e0de71`）は Obsidian の既定のまま**。画素は Computed Style では見えない |
| Canvas | 既定が残る: ノードの枠とエッジ（`#7e7e7e`）、ドットの背景（`#333333`）、色 1〜6（赤・橙・黄・緑・シアン・紫の Obsidian の既定）。背景とカードのラベルはテーマの色 |

- **原因**: Canvas と Graph の既定の色は、`--color-<色名>`・`--color-<色名>-rgb`、`--color-base-30`・`-35` を参照する（`app.css`: `--canvas-color-N: var(--color-<色名>-rgb)`、`--canvas-dot-pattern: var(--color-base-30)`、`--graph-line: var(--color-base-35, …)`、`--graph-node-tag: var(--color-green)`、`--graph-node-attachment: var(--color-yellow)`）。このテーマは、これらを定義していない（`--color-*` 37 変数のうち 29 が既定のまま）。ただし `--color-base-*` の既定は、上の UI の見える色には出てこない（パレットにない色が 0）。
- **`--canvas-color`（ノードの既定の枠の色）**: Obsidian が `body.theme-dark` で定義する（詳細度 (0,1,1)）ので、`.theme-dark` の指定では上書きできない（research/05。今回も SD・KD とも `#7e7e7e` のまま）。
- 参照関係は、手元にある古い `app.css`（2026-02 の日付のコピー）を grep で読んだ。実行時の既定の値は、そのコピーの参照先の値（`--color-red` など）と同じだった。1.14.5 の asar の `app.css` そのものは開いていないので、参照関係は 1.14.5 では未確認。

## Minimal・Things の実際のソース（読んだだけ。リポジトリには入れていない）

- Minimal（kepano/obsidian-minimal `93321bd`、MIT）:
  - `src/scss/plugins-core/canvas.scss`（27 行）: `--canvas-dot-pattern: var(--background-modifier-border-hover)`、エッジと `.canvas-node-container` の枠を `var(--background-modifier-border-focus)` にする。つまり、Canvas の灰色を、テーマの境界の変数に結びつける。色は新しく作らない。
  - `src/scss/app/bases.scss`（31 行）: `--bases-table-font-size` などの変数と、ツールバーの表示の制御だけ。色の規則はない。
  - `src/scss/app/metadata.scss`（32 行）: `--input-height`、区切り線の幅など寸法の変数。色の規則はない。
  - `src/scss/plugins-core/search.scss`（2 行）、`backlinks-outlinks.scss`（12 行）: 余白と文字のスタイルのみ。
  - Graph の専用の規則はない。
- Things（colineckert/obsidian-things `9b8bef9`、`theme.css`）: Canvas・Graph・Bases・Properties の規則はない。検索の一致語の強調（`body.fancy-highlight span.search-result-file-matched-text`）が選択式である。
- 学べること: 変数で足りる UI は変数だけで整える。Canvas の灰色は、色を足す代わりに、テーマの既存の境界の変数に結びつける。

## 確かめていないこと

- 画素。Canvas の色の見え方、Graph の描画、Bases の配置、Properties のアイコンは、画像で見ていない。Graph の描画の色は、`renderer.colors` を読んだもので、描かれた画素ではない。
- hover・フォーカス・選択などの状態、translucent、popout の窓、モバイル、1.14.4 と E43。
- Obsidian の Properties の入力型のすべて、Bases の kanban、Canvas のメディアのノード。
