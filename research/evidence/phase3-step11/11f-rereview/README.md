# 工程 11F の再レビュー対応の証拠（2026-10-18）

[14](../../../14-implementation-plan.md) §6.56 の証拠。

- Obsidian はすべて隔離インスタンス（専用の `--user-data-dir` とテスト Vault の複製）で動かした。普段の Vault・設定・Inkdrop・実機・macOS の表示設定と Space には触れていない。
- E43 を使ったあとは、毎回 LaunchServices の既定を戻した。そのうえで、`current-installer.sh check` の出力が前後で同一であることを確かめた。確かめたのは 3 回: タイトルバーの測定のあと、run-all の中、画素のあと。
- `check` の出力には利用者のパスが入るので、入れていない。ファイルの中のローカルのパスは、`<work>`・`<clone>`・`<repo>`・`~` などに置き換えた。

**検証の対象**: コミット `d027f61`（修正の 4 コミットの最後）。リポジトリを scratch に新しく clone し、`npm ci` と build をしてから、run-all と画素の道具を実行した。

- `regress/summary.json`: `commit: d027f61`、`dirty: false`、`complete: true`。
- 環境: macOS 26.5.2、Node 22.22.0、npm 10.9.4、Obsidian 1.14.4（E39: Electron 39.5.1、E43: Electron 43.7.7）。

## 1. translucent のタイトルバー（`titlebar/`）

`titlebar-probe.mjs` で測った。同じ隔離インスタンスで、修正前（`fab7442` のビルド）と修正後（`1498c33` 以降のビルド）のテーマを入れ替えた。測ったのは E39・E43 × custom frame・hidden frame。

- 状態: 不透明 → translucent → translucent に body の `is-fullscreen` を足した状態（ページの中での模擬。本物の全画面にはしていない）→ 不透明に戻す。
- 各状態で記録したもの:
  - `.titlebar` の表示・大きさ・計算値の `background-color`。
  - `.titlebar` に当たる規則の `background-color` の宣言（カスケードの順。CDP `CSS.getMatchedStylesForNode`）。
  - ほかの面の背景色: `.app-container`、Ribbon、上のタブ帯、左ドック、エディタ、ステータスバー。
  - 上 60px の CDP の画像。

| ファイル | 内容 |
|---|---|
| `titlebar-<E>-<frame>.json`・`.txt` | 測定値と、適用された規則 |
| `before-after.txt` | 修正前と修正後で値が違うところ。`tb-diff.mjs` で作った |
| `png/` | custom frame の translucent・不透明に戻した状態・全画面の模擬の画像（修正前・修正後、両テーマ）と、hidden frame の translucent の画像（修正後、SD）。CDP の画像は、macOS が合成する半透明を写さない（透明は透明のまま写る） |

**結果**（E39・E43 で同じ）: 修正前と違うのは `.titlebar` の translucent の状態だけ。

| | 修正前 | 修正後 |
|---|---|---|
| custom frame、translucent | SD・KD とも `rgba(0, 0, 0, 0)` | SD `rgba(0, 33, 41, 0.7)`、KD `rgba(24, 22, 22, 0.7)` |
| custom frame、不透明・不透明に戻した状態 | SD `rgb(0, 45, 56)`、KD `rgb(24, 22, 22)` | 同じ |
| custom frame、全画面の模擬 | `display: none` | 同じ |
| hidden frame、translucent | `display: none`、`rgba(0, 0, 0, 0)` | `display: none`（表示されない）、値だけ acrylic |
| ほかの面（全状態） | — | 修正前と同じ |

修正後の translucent では、最後に当たる規則は `.theme-dark.is-translucent:not(.is-fullscreen) .titlebar`（`!important` なし）。その前に app.css の `.is-translucent:not(.is-fullscreen) .titlebar, … .app-container` が当たる。

## 2. 統合の回帰（`regress/`）

`tests/integration/run-all.mjs` を実行した。基準は、11F の回帰の run 1（`../11f/regress/`）。全 42 段（隔離インスタンスの起動・停止を含む）が成功した。

- 実行時の検査: E39・E43 とも 3,871 件で FAIL 0。内訳は 11F と同じ（PASS 2,430、PASS (EMULATED) 805、DIFF 606、UNSUPPORTED 30）。
- 基準との比較: 状態の差 0。詳細だけの差は次の 3 つ。
  - `runner.theme-applied`: CSS の文字数。
  - `runner.environment`・`runner.pointer-prepared`。
  - 多くの文字の要素の高さが +1px（§4）。
- run 1 と run 2 の差: 詳細だけ 9 件。
- 陰性テスト: 両 Electron とも 704 件（11F の 703 + HTML ラベルの filter 1）がすべて宣言どおり。
- custom frame の実行（`*-frame.json`）: 両 Electron とも 31 件すべて PASS。translucent も PASS。
- キット: 組み立て 34、プラグイン 63、phone の dry run 5、tablet の dry run 8 が、すべて PASS。キットは、この clone のソースから作った。
- `release-gate.json`:
  - NOT MET（変わらず）。
  - macOS のデスクトップは PASS 135、DIFF 2（`qd13.fidelity`）、NO RESULT 1（`qd22.real-fullscreen`）。
  - 保存した判定との差は、`qd1.titlebar-visible-frame` × 2（UNVERIFIED → PASS）。
- run-all の終了ステータスは 1。理由は、次の 2 つの記録を「問題」として数える設計のため。テストの失敗ではない。
  - 基準のあと、仕様とソースが変わった。
  - 保存した判定と 2 単位違う。
- `steps/` からは、LaunchServices の `check` の 2 つの段を外した（パスを含むため）。

## 3. 画素の道具（`mermaid-pixels/`）

修正後の道具（`12d2b8f`）を、同じ clone で両 Electron で実行した。

- `restore-self-test-<E>.*`: 復元の陰性テスト 8 件。両 Electron とも、すべて宣言どおり。次を確かめた。
  - 変更の後に、style 属性と計算値がすべて元どおりになる。
  - 測定中に例外が起きても元に戻る。
  - 二重の変更を拒む。
  - 従来の `removeProperty` による戻し方は、Mermaid が付けた style 属性を変えてしまい、それを比較で検出できる。
- `mermaid-pixels-<E>.*`: 8 図すべて PASS。SVG ラベル（block 2）を含め、固定の比較で差 0 画素。
  - 対照は 3 種で、すべて検出でき、正確に元に戻った。
  - 図形の fill: 43,000〜54,000 画素。
  - SVG テキストの fill: 505 画素。
  - HTML ラベルの `blur(2px)`: 909〜916 画素。
- `png/`: block 2 の Obsidian・参照・固定の 1 枚目。

## 4. 文字の要素の高さ（`environment-height/`）

11F（2026-10-16）の回帰と比べると、文字の要素の高さの多くが 1px 大きかった（例: リンク 39×18 → 39×19）。色は同じ。

- 同じ隔離インスタンスで、修正前と修正後のビルドを測った。どちらも 19 だった（`result.txt`、`height.mjs`）。
- テーマの修正によるものではない。
- 2026-10-16 以降の環境の変化と考えているが、原因は特定していない。Mermaid の図の大きさも変わった（block 2 は 214×296 → 214×297、block 3 は 450×650 → 450×663）。
