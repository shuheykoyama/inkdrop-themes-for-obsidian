# 工程 11F（ランナーとキットの保守）の証拠（2026-10-17）

[14](../../../14-implementation-plan.md) §6.54 の証拠。Obsidian はすべて隔離インスタンス（専用の `--user-data-dir` とテスト Vault の複製）で動かした。普段の Vault・設定・Inkdrop・実機・macOS の表示設定と Space には触れていない。テーマ CSS、Q-D の判断、SVG ラベル以外の期待値・許容差は変えていない。

E43 を使ったあとは、毎回 `tests/runtime/current-installer.sh restore` で LaunchServices の既定を戻した。そのうえで、`check` の出力が作業の前と同一であることを確かめた。確かめたのは 4 回: run-all の中、画素と監査のあと、追加の画素と診断のあと、新しい環境の確認のあと。`check` の出力には利用者のパスが入るので、リポジトリには入れていない。ファイルの中のローカルのパスは `<work>`・`<repo>`・`~` などに置き換えた。

## 1. SVG ラベルの画素の検証（`mermaid-pixels/`）

`tests/visual/mermaid-pixels.mjs`（コミット `c2f917e`）で、Obsidian がテーマ付きで描いた図と参照を、同じページ・同じレンダラーで比べた。方法は 14 §6.54.1。

| ファイル | 内容 |
|---|---|
| `mermaid-pixels-e39.json`・`.txt` | E39（Electron 39.5.1）。8 図すべて PASS |
| `mermaid-pixels-e43.json`・`.txt` | E43（Electron 43.7.7）1 回目。block 0（HTML ラベル）が両テーマで FAIL（固定で SD 9 画素、KD 6 画素）。block 2（SVG ラベル）は 0 |
| `mermaid-pixels-e43-2.*`・`-3.*` | E43 の 2 回目・3 回目（差の頻度を見るため）。8 図すべて PASS |
| `e43-block0-pixels-*.txt` | E43 1 回目の block 0 で、固定と参照の 1 枚目どうしで値が違う画素。各画素について、固定の全撮影と参照の全撮影の値の集合も示す（除外された画素も含む）。`pixwhere.py` で作った |
| `png/` | 両 Electron・両テーマの block 2 の Obsidian・参照・固定の 1 枚目と、E43 1 回目の block 0 の固定・参照の 1 枚目 |

ブロックの番号: 0 = 大きな flowchart（HTML ラベル）、1 = 小さな flowchart、2 = SVG ラベルのブロック（`htmlLabels: false`）、3 = sequence。

## 2. 判定の変更の確認（`audit/`、`regress/`）

- `audit/important-audit-e43.json`・`.txt`: 新しい判定で `!important` の監査（E43）をやり直した結果。テストのノートはコミットしたものそのまま。
  - 88 件すべてで判定が 11E（`../11e/audit/`）と同じ。必要 86、検証不足 2。
  - FAIL する検査の数も全件同じ。検査の網羅の漏れは 0。
  - #11・#14・#20 は、通常のノートで FAIL として捉えた。
- 実行時の陰性テスト 10 件（描かれるプロパティの変化は FAIL、描かれないものは PASS）は、`regress/runtime-electron-*-self-test.json` の `mm.self-test`。CI の 25 件は `regress/steps/mermaid-judge-self.txt`。

## 3. 統合の回帰（`regress/`）

`tests/integration/run-all.mjs` の実行。11E の回帰の結果を基準にした。

- `run-all.log`・`summary.json`・`steps/`: 各段の出力。
  - E39・E43 とも、実行時は 3,871 件で FAIL 0、陰性テストは 703 件すべて宣言どおり。
  - custom frame の実行（`*-frame.json`）は translucent の 2 件が FAIL（§4）。
  - `kit-dry-run`・`kit-dry-run-tablet` の 2 段は、テストの誤り（ページの側の `require("obsidian")`）で止まった。直したあとの単独の実行が §5。
- `runtime-electron-*-run1.json`・`-run2.json`・`-self-test.json`・`-frame.json`: 結果。
- `release-inputs.json`・`release-gate.json`: この実行の結果でのリリースの判定。NOT MET で、保存した判定との差は `qd1.titlebar-visible-frame` × 2（UNVERIFIED → FAIL）。
- LaunchServices の `check` の 2 つの段の出力は、パスを含むので `steps/` から外した。前後が同一であることは run-all が確かめている。

## 4. custom frame のタイトルバー（`regress/runtime-electron-*-frame.json`）

`OBSIDIAN_FRAME=custom` で起動したインスタンスでの実測。両 Electron で同じ値だった。`.titlebar` は表示され、大きさは 1024×30。

| | SD | KD |
|---|---|---|
| 不透明 | `rgb(0, 45, 56)` PASS | `rgb(24, 22, 22)` PASS |
| translucent | `rgba(0, 0, 0, 0)` FAIL | `rgba(0, 0, 0, 0)` FAIL |

translucent では、app.css 1.14.4 L6575〜6578 の `--workspace-background-translucent` がタイトルバーに当たる。テーマはこの変数を透明（`--ink-page-background-acrylic`）にしている。CSS は変えていない（14 §6.54.3、§6.54.9）。

## 5. tablet のキット（`kit-dry-run-tablet/`、`kit-dry-run-phone/`）

`tests/device/kit-self-test.mjs dry-run-tablet` と `dry-run` を、テストを直したあとに単独で実行した結果。

| ファイル | 内容 |
|---|---|
| `kit-self-test.json`・`dry-run.log` | 自己テストの合否。tablet は 8 件すべて PASS、phone は 5 件すべて PASS |
| `results-*.json` | プラグインの生の結果（`device` 付き） |
| `report-emulated.json`・`judge.txt` | `judge.mjs` の判定。tablet は 406 件で、FAIL は `device.environment` の 14 件だけ。phone は 916 件で、FAIL は 52 件だけ |
| `tour-*.json` | ツアーの記録。tablet は 18 段（9 段 × 2 テーマ） |

## 6. 構文の陽性対照の診断（`syntax-diagnosis/`）

- `diag-sim.mjs`: 隔離インスタンス（E39）で、Reading view の `js` の `<code>` を問い合わせから隠し、`code-tokens.js` を実行する再現の手順。
- `syntax-diagnosis-simulated.json`: そのときの FAIL の詳細。行・言語、スクロール、描かれている言語、セクションの数、visibility、フォーカス、アクティブなリーフ、1.5 秒後の状態。フォーカスが false なのは、この再現では CDP のフォーカスの保持を使っていないため。

## 7. 新しい環境での確認（`fresh-environment/`）

`tests/README.md` のコマンドだけで、新しい clone から確かめた手順と結果。14 §6.54.5。

- `fresh.sh`: 実行した手順。
- `fresh.log`: その出力。
- `frame.json`: E39 の custom frame の実行。不透明 PASS、translucent FAIL。
- `pixels.json`: E43 の画素の比較。8 図すべて PASS。

## 8. 版

| もの | 版 |
|---|---|
| macOS | 26.5.2 |
| Node.js / npm | 22.22.0 / 10.9.4 |
| Python / Pillow | 3.12.6 / 12.3.0 |
| Obsidian | 1.14.4（E39: installer 1.11.7 の Electron 39.5.1 + 1.14.4 の asar、E43: 1.14.4 の Electron 43.7.7） |
| pymobiledevice3 | 11.29.0（入っている版、検証済み）。PyPI の最新は 11.33.0（2026-10-16 公開）。更新していない |
