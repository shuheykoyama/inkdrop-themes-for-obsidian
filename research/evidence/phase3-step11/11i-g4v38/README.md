# G4 の補強と V-38 の事前の確認（2026-11-01）

[14](../../../14-implementation-plan.md) §6.152・§6.153 の証拠。全画面にも、撮影にも、Inkdrop の操作にも、まだ入っていない。

## ファイル

- `g4.mjs`: G4 の測定の道具。`../11g-g4/g4.mjs`（SD 専用、1.14.4 の記録）の写しを直したもの。元のファイルは変えていない。
  - `node g4.mjs <repo> <vault> <out.json> prep|full solarized-dark|kanagawa-dragon`
  - テーマは引数で選ぶ。ほかの名前は受け付けない（exit 2）。
  - `prep`: Obsidian が読み込んだテーマの名前、長さ、SHA-256 が、`dist/<theme>/theme.css` と同じことを確かめる。違えば、面を読まずに止まる。
  - `full`: 別のテーマや別の CSS で準備したファイル、すでに全画面の結果を持つファイルは使わない。全画面に入る前にも、読み込まれたテーマを確かめ直す。
  - 全画面に入るよう頼んだあとは、何が失敗しても、必ず出るよう頼む。出たあとに、`isFullScreen()`、`is-fullscreen` のクラス、Space の種類ごとの数（`../11g-g4/spaces.sh`）を読む。
  - 入って、読んで、出るまで誤りがなかったときだけ、`during`・`after` に `status: COMPLETE` で記録する。
    - それ以外は `failedRun` に分けて記録する。出られたときは `status: ABORTED` で exit 1、出られなかったときは `status: STUCK` で exit 3。
    - STUCK のときは、ユーザーに伝え、Mission Control を見てもらい、隔離インスタンスを止める。
  - 12 の面、読む時機、合格の条件（§6.67.4）は元のまま。
- `g4-self-test.mjs`・`g4-self-test.txt`: 自己テスト（12 例）。偽の `<repo>` の `tests/runtime/lib/cdp.mjs` が、窓（全画面、クラス、テーマ）を演じる。
  - 確かめる場面: 両テーマの準備、ないテーマ名、読み込まれた CSS の違い、正常な全画面、全画面の中で読めない、全画面に入れない、出られない、全画面の中で接続が切れる、別のテーマで準備したファイル、準備のあとのテーマの変化、2 回目の実行。
  - `npm test` には入れていない（ほかの証拠の道具と同じく、手で実行する）。
- `g4-mutation.txt`: 自己テストの検出力の確認。終了処理を外した版と、すべてを COMPLETE にする版で、それぞれ 4 例が FAIL になった。
- `v38-precheck-g7-1.csv`: V-38 の Inkdrop の領域（`tests/visual/configs/v38-inkdrop.json`）を、G7-1 で撮った Inkdrop 6.2.0 の画像 3 枚に当てた結果（`tests/visual/sample-regions.py`）。G7-1 の画像は、V-38 と同じ 1200×700 の窓。ただし、ノートと撮影の条件は V-38 と違う。

## V-38 の事前の確認の結果

- 道具と判定の規則は、V-38（`52434a5`、2026-10-11）から変わっていない。
  - 領域の設定 2 つ、`v38-compare.py`（7 組、ΔE2000 ≤ 1.0、平らさ 1.0）、`sample-regions.py`、`capture-inkdrop.sh` は同じ。
  - `capture-obsidian.sh` は、任意の機能（ノート・ビューの指定、Inkdrop を触らない指定）が増えただけで、既定の動きは同じ。
- Inkdrop 6.2.0 の同梱のコード（`app.asar` を読んだだけ。SHA-256 は G7-0 の記録と同じ）:
  - 道具が使う API とコマンドは、すべてある（`inkdrop.config`、`themes.getActiveThemeNames`、`window.setSize`・`setPosition`、`view:toggle-preview`、`editor:focus`、`core:focus-note-list-bar`、`getExports`）。
  - 道具が読むクラスも、すべてある（`acrylic-window`、`is-blurred`、`.mde-preview`、`.main-layout`、`.sidebar-layout-content`、`.note-list-bar-layout-content`、`.editor-layout`、`#app-container`）。
  - 窓は、今も `visualEffectState: 'active'` で作られる。
- 領域（G7-1 の画像。V-38 の撮影ではない）:
  - ノートの一覧の領域: 3 枚とも平ら（標準偏差 0）。
  - サイドバーの領域 (20, 470, 130, 160): 通知がない画像（SD の p01）では平ら。アップデートの通知（「2 plugin updates available」「New version 6.3.0 is available!」）が出た画像（SD の p06、KD の p01）では平らでない（標準偏差は最大 44.8）。通知の帯と「Synced at」の行が、領域にかかる。
  - エディタの領域: G7-1 は別のノートなので、判断できない。V-38 のサンプルノートで撮って確かめる。
- 実際の画面での確認（選択子が働くこと、7 組の領域が平らなこと、窓の大きさと位置）は、撮影の準備ができてからでないとできない。
- 領域と判定の条件は変えていない。
