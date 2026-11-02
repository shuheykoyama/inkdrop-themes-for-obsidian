# KD の Canvas 色 2〜6 の候補の比較（2026-11-03、数値だけ、撮影なし）

[14](../../../14-implementation-plan.md) §6.174 の証拠。製品の CSS、検査の仕様、ゲートの入力は変えていない。試験の変更は、スクラッチの隔離クローンだけ（`trial-kd-canvas.patch`）。

## 問題

`11n` の撮影で、KD の Canvas の色 2〜6 の枠が、色なしのノードの枠と区別しにくかった。原因は、KD のパレットの色の彩度が低いこと（CIELAB の彩度 C: 橙 20、黄 23、緑 18、aqua 8、violet 12。色なしの枠は C 3、赤は 35）。1px の枠は、C が 15 より小さいと、色がついて見えず、灰色に見える。

## 方法（`candidates.mjs`、結果は `candidates.txt`）

- `src/palette/kanagawa-dragon.css` の HSL の値を読む（値を書き写さない）。
- 色の意味（橙・黄・緑・シアン・紫）を保つ候補だけを、パレットから選ぶ: 橙 = `dragon-orange`・`autumn-yellow`（色相 33°）・`ronin-yellow`（30°）、黄 = `dragon-yellow`・`old-white`、緑 = `dragon-green2`・`spring-green`・`autumn-green`、シアン = `dragon-aqua`・`wave-aqua1`、紫 = `dragon-violet`・`dragon-teal`・`dragon-pink`。色相が違う色（橙に黄、シアンに青）は候補にしない。
- 各候補の彩度 C、背景（`rgb(30,29,26)`）に対するコントラスト、色なしの枠の色（背景に `--ink-disabled-text-color` を重ねた `rgb(80,81,77)`）との色差（CIEDE2000）、6 色同士の色差を比べた。

## 結果

| 色 | 現行 | 現行の C | 候補 | 候補の C | 判断 |
|---|---|---|---|---|---|
| 1 赤 | `dragon-red` | 35 | — | — | 維持 |
| 2 橙 | `dragon-orange` | 20 | `autumn-yellow`（33°、`--ink-syntax-changed-color`） | **45** | **変更**。`ronin-yellow`（C 69、`--ink-warning-color`）は強すぎる。画像で橙と黄が近ければ代替 |
| 3 黄 | `dragon-yellow` | 23 | `old-white`（C 25） | 25 | 維持。パレットにこれより彩度の高い黄がない |
| 4 緑 | `dragon-green2` | 18 | `spring-green`（`--ink-md-list-mark-3-color`） | **45** | **変更**。`autumn-green`（C 27）は現行と ΔE 5.7 しか違わない |
| 5 シアン | `dragon-aqua` | **8** | `wave-aqua1`（C 17、色相 163° で緑寄り） | 17 | 維持。**改善できない**（パレットに彩度の高い aqua がない） |
| 6 紫 | `dragon-violet` | **12** | `dragon-teal`（C 13、青）・`dragon-pink`（C 10、色相 321°） | 10〜13 | 維持。**改善できない** |

- 2 と 4 だけを替えると、彩度は 橙 20 → 45、緑 18 → 45。6 色の色差は、最小が 4-5 の 12 から、2-3 の 11（橙と黄が近づく）になる。そのほかの組は 14 以上。緑とシアン（4-5）は 12 → 22、橙と赤（1-2）は 14 → 25 に広がる。
- 5（C 8）と 6（C 12）は、どの候補でも C 17 以下で、灰色に見える。意味を保つ範囲で、パレットにこれより鮮やかな aqua・violet はない。**この 2 色は、選択肢 (a)（KD の落ち着いたデザインとして受け入れる）にする**ことを提案する。
- 注意: 橙（autumn-yellow、色相 33°）と黄（dragon-yellow、色相 41°）の色差は 11 と近いが、彩度が 45 対 23 と違う。画像で確かめる。近すぎれば、橙を `ronin-yellow`（KD が警告の色に使う橙。色差 19）に替える案がある。

## 試験の最小差分（`trial-kd-canvas.patch`）

- 新しい `src/themes/kanagawa-dragon/canvas.css`（KD の入口の最後に `@import`）: `.theme-dark:is(body) { --canvas-color-2: var(--ink-syntax-changed-color); --canvas-color-4: var(--ink-md-list-mark-3-color); }`。新しい色や、パレットの宣言は足さない。既存の `--ink-*` を使う（静的検査 S1・S4 が、パレットの外の色のリテラルを禁じる）。同じセレクタで共通の規則のあとに置き、同じ詳細度で勝たせる（`no-descending-specificity` を避ける）。
- `tests/spec/runtime/desktop.json`: 共通の 2 検査（色 2・4）を SD だけに限定し（`themes`）、KD 用の検査（`--ink-syntax-changed-color`・`--ink-md-list-mark-3-color`）を足す。
- 試験のクローンで、静的検査が全部通る。実行時の検査は、まだ回していない（隔離 Obsidian を動かすので、ユーザーの許可を待つ）。

## レビュー用の比較画像（`../11n-canvas-graph-trial/review/`）

ChatGPT が GitHub から画像を取得できないので、ユーザーに添付してもらうための 4 枚。`make-review-images.py` が、撮影済みの 20 枚から作る。

- `solarized-dark-canvas.png`・`kanagawa-dragon-canvas.png`: 上が最終ビルド（今の製品の CSS）、下が試験（Canvas の色の変数）。ノードの列とグループを 1.6 倍に拡大。
- `solarized-dark-graph.png`・`kanagawa-dragon-graph.png`: 左が最終ビルド、右が試験。Graph の枠。
- いずれも、KD の色 2・4 の試験（このディレクトリの差分）はまだ含まない。

## 撮影（2026-11-03、`../11n-canvas-graph-trial/shots-kd-v2/`）

ユーザーの許可のあと、`capture-run.sh` に `--theme=kanagawa-dragon --canvas-only` を付けて、KD の Canvas だけを撮った（8 枚、最終ビルドと、色 2・4 を変えた試験ビルド × Canvas 4 画面）。`--check` が通ってから撮影。読み込んだ CSS の SHA-256 は、最終 `b784835f…`、試験 `9cc55c6f…`。2 条件で、Canvas のノード 11・エッジ 3、ズームと位置、窓が一致（問題 0）。8 枚すべてを全体画像で確認した。ほかのウィンドウの写り込みはない。`../11n-canvas-graph-trial/review/kanagawa-dragon-canvas-three-way.png` は、最終ビルド・試験 1（共通の変数だけ）・試験 2（色 2・4 を変えた）を縦に並べた比較。

見えたこと（採否の判定ではない）:

- **色 2（橙）**: 試験 2 では、枠が琥珀色（autumn yellow）になり、色なしの枠と区別できる。試験 1 では、色なしの枠とほぼ同じ灰褐色だった。
- **色 3（黄）との区別**: 色 2 の琥珀色は、色 3 のくすんだ黄褐色（dragon-yellow）より、橙に寄って見える。区別できるが、1px の枠では差は大きくない。**`ronin-yellow` への替えは、今の画像では要らないと見る**（判断はレビュー）。
- **色 4（緑）**: 枠が、くすんだ灰緑から、明るめのオリーブ寄りの緑（spring green）になり、色なしの枠と区別できる。色付きのグループの名前の背景は、試験 1 の灰緑から、明るい黄緑になり、色 4 らしさが出る（最終ビルドの鮮やかな緑ほど強くない）。選択した色 4 のノードの 2px の輪も、はっきり見える。
- **色 5・6**: 試験 2 でも、灰色に見える（変えていない。パレットに候補がない）。
- **色 1・`#ff8800`**: 変わらない。
- **雰囲気**: 全体は落ち着いたまま。最終ビルドより静かで、鮮やかな緑・シアン・紫は出ない。
- 色なしのノードを選択すると、アクセントの枠が出る（変わらない）。エッジの選択は、ツールバーで確認でき、線の強調は見て取れない（変わらない）。

## 確かめていないこと

- 試験の差分の、実行時の検査（隔離 Obsidian が要る。許可のあと）。
- ホバー、ドラッグ、ズームアウト、translucent、popout、モバイル。画像は 1200×800 の 1 つの窓だけ。
