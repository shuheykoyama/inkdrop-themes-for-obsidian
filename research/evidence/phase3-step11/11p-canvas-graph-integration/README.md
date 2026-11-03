# Canvas・Graph の配色の製品 CSS への統合の検証（2026-11-03）

[14](../../../14-implementation-plan.md) §6.176 の証拠。統合のコミットは `b3d1989`（`feat(canvas)`）。ゲートの入力、Q-D、オラクルの許容差は変えていない。

## 統合したもの

- `src/common/mapping/canvas-graph.css`（共通）: `--canvas-color-1..6`、`--canvas-dot-pattern`、`--graph-line`、`--graph-node-tag`、`--graph-node-attachment`（`.theme-dark`）、`--canvas-color`（`.theme-dark:is(body)`、`app.css` の `body.theme-dark` と同じ詳細度であとに読み込む）。色は両テーマの既存の `--ink-*` から解決する。
- `src/themes/kanagawa-dragon/canvas.css`（KD 固有）: `--canvas-color-2` = `--ink-syntax-changed-color`（`autumn-yellow`）、`--canvas-color-4` = `--ink-md-list-mark-3-color`（`spring-green`）の 2 変数だけ。元の Kanagawa パレット変数（`--kanagawa-*`）を直接参照すると、静的検査 S1・S4（パレットの外の色のリテラルの禁止）に反するので、既存の `--ink-*` を使った。解決値は trial 2 と一致する。
- `tests/spec/requirements.json` に `ui.canvas-graph`（非必須、Obsidian 固有）、`tests/spec/runtime/desktop.json` に 13 検査（両テーマ共通の 9 変数 + SD 用の色 2・4 の 2 件 + KD 用の色 2・4 の 2 件。SD も KD も、それぞれ 11 変数を検査する）。
- 統合したビルドは、撮影した試験ビルドとバイト単位で同じ（SD `f6b59e61…`、KD `9cc55c6f…`）。撮影した画像は、そのまま統合後の見た目に当たる。

## 検証

- **静的検査**: ビルド、S1〜S5（stylelint を含む）、`npm test` が終了コード 0。
- **対象限定の実行時検査**（`probe-product.json`、`compare-vs-final.txt`、`compare-vs-trial1.txt`。隔離 Obsidian 1.14.5 / Electron 39.5.1）: 379 変数を比べて、最終ビルドからの変化は SD・KD とも設計した 11 変数だけ（KD の色 2 `rgb(220,164,96)`、色 4 `rgb(152,188,108)` は trial 2 の値）。試験 1 からの変化は、SD が 0、KD が色 2・4 の 2 変数だけ。Graph の描画の色は、`fillTag`・`fillAttachment`・`line` の 3 つだけ変わる。テーマなしの条件は 0 差。
- **macOS 4 環境のフル回帰**（`regression/`）:

  | 環境 | run1 | run2 | 自己テスト | frame | 基準との比較 |
  |---|---|---|---|---|---|
  | 1.14.4 / E39.5.1（`out-1.14.4-e39`） | 3915 件、FAIL 0 | 同じ | 791 件が宣言どおり | 31 件 PASS | 状態の変化 0、新しい 44 件が片側にだけ、run1 と run2 の差 0 |
  | 1.14.4 / E43.7.7（`out-1.14.4`） | 同上 | 同じ | 791 件 | 31 件 | 同上 |
  | 1.14.5 / E39.5.1（`out-1.14.5`） | 同上 | 同じ | 791 件 | 31 件 | 同上 |
  | 1.14.5 / E43.8.3（`out-1.14.5`） | 同上 | 同じ | 791 件 | 31 件 | 同上 |

  どの環境も、DIFF 576・UNSUPPORTED 30・PASS (EMULATED) 820 は、基準（`5a9e5b1`）と同じ。ステップの失敗は 0、隔離 Obsidian の停止と E43 の installer の復元を確認した。基準の既存 3871 件に、予期しない状態の変化はない（SD の次に KD を測っても、新しい検査は KD の値で PASS）。
- **`summary.json` の `problems`**: 基準との比較が「同じでない」こと（新しい 44 件が片側にだけあるため）、基準から変わったソースの注意、この回帰の範囲に入れなかった kit dry-run（別に実施、下記）。実際のテストの失敗ではない。

## 手順の誤りと、その訂正

最初の 1.14.4 の回帰を始めるとき、環境変数 `OBSIDIAN_ASAR` に 1.14.5 の asar を指定したままだった。そのため、`out-1.14.4` の中の「E39.5.1」は、実際には **1.14.5 / Electron 39.5.1** で動いた（`e39-run1.txt` などの末尾に `Obsidian 1.14.5` と出ている）。E43.7.7 は installer の版（1.14.4）で正しい。この結果は消さず、ここでは「1.14.4 の枠に入った 1.14.5 / E39.5.1」として扱い、1.14.5 の回帰（`out-1.14.5`）の E39.5.1 と同じ結果になっている。1.14.4 / E39.5.1 は、環境変数を外して回し直した（`out-1.14.4-e39`。末尾に `Obsidian 1.14.4, Electron 39.5.1`）。
`regression/raw-json.sha256` の `1.14.4-labelled/` が誤った枠の結果、`1.14.4-e39/` が正しい 1.14.4 / E39.5.1。

## iPhone の新しいキット（`kit/`）

- kit id `c60ce128-4211-4b20-a132-325c72efdb49`（`b3d1989` の新しいクローンで作成）。ZIP の SHA-256 `f71918ff…`、SD の `theme.css` `f6b59e61…`、KD の `theme.css` `9cc55c6f…`。ランナーとオラクルは `5a9e5b1` から変わっていない。
- 旧キット `79751c34…`（`5a9e5b1`）とは、2 つの `theme.css`、マーカー、プラグインの `main.js`（キット ID を持つ）だけが違う（18 ファイル）。旧キットは保持している。
- 自己テスト（`kit-self-test-*.txt`、Mac 上。iPhone は操作していない）: build 34 件、plugin 63 件、dry-run 7 件が PASS。

## 生の結果の保全

生の結果 JSON は、リポジトリに入れていない。`~/inkdrop-obsidian-evidence-raw/11p/` に gzip（10 件）、`~/inkdrop-obsidian-evidence-raw-copy/11p/` に同じ 1 セット。元ファイルの SHA-256 は `regression/raw-json.sha256`。**どちらも同じディスクで、ディスクの故障への独立のバックアップではない。**

## 確かめていないこと

- iPhone の実機、G4、V-38、G8。
- Canvas・Graph の統合後の画素（撮影した試験ビルドとバイト単位で同じなので、新たな撮影はしていない）。
- モバイルでの Canvas・Graph の見た目。
