# 工程 11G C1-a: 副作用の測定（2026-10-30）

[14](../../../../14-implementation-plan.md) §6.139 の証拠。

## 何をしたか

- 隔離した Obsidian 1.14.5（Electron 39.5.1、`tests/runtime/obsidian-isolated.sh`）で、C1-a の前と後の CSS を測った。
  - 前: `23aa0f5` のクローンのビルド（`theme.css` の SHA-256 は KD `7a3715ca…`、SD `b98da149…`）
  - 後: C1-a の作業ツリーのビルド。`4a815b8` と同じ CSS（KD `0ffa883e…`、SD `0f8e864f…`）
- 対象のノート: `Code blocks.md`、`Markdown elements.md` と、調べるためのノート 2 つ（`C1 probe.md`、`C1 embedded.md`）。
  - 調べるためのノートは、隔離した Vault のコピーにだけ置いた。`tests/fixtures/vault` には入れていない。
  - 中身: 言語あり・言語なし・知らない言語のコードブロック、インラインコード、数式、`kbd`、表の中のインラインコードと数式、コールアウトの中のインラインコードとコードブロック、ノートの埋め込み、ホバーのプレビューを開くリンク。
- 各テーマ × ノート × ビュー（Reading、Live Preview、Source）で、上から下までスクロールしながら、すべての要素の計算されたスタイルを記録した。記録したのは color、background-color、border-top-color、border-left-color、text-decoration-color、fill、stroke、display。
- 「前」の測定では、`.theme-dark .markdown-rendered` の `--code-normal` だけを目印の色（rgb(1, 2, 3)）にして、もう一度記録した。値が変わった要素を、Reading の `--code-normal` が届く要素（reached）とした。

## ファイル

- `c1-probe.mjs`: 測定の道具。`node c1-probe.mjs <repo> <vault> <out.json>`。CDP のポート 9333 の隔離した Obsidian に対して動く。
- `before.json`、`after.json`: 測定の結果。
- `c1-compare.mjs`、`c1-compare.txt`: 前と後の比較。
- `regress-a/`: `4a815b8` での 1.14.5・1.14.4 の回帰（§6.139.5。1.14.4 E43.7.7 で `ui.button.background` が FAIL）。
- `button-dom/`: 4 つの条件の About タブの DOM と、セレクタの比較（§6.139.6）。
- `regress-b/`: `35647fd`（新しい spec）での 1.14.4・1.14.5 の回帰（§6.139.7）。

## 結果

- Reading の `--code-normal` が届くのは、コードブロックの `code` と、その中で自分の色の規則がないトークン（template-string、string-interpolation など）だけ。
  - 言語あり・言語なし・知らない言語のどれも同じ。
  - Reading view、コールアウトの中、埋め込みの中、ホバーのプレビュー（KD）、Live Preview の中のコールアウトと埋め込み。
  - `pre` そのものには届かない。`pre` の色は本文の色を受け継ぐ。
  - Reading のフロントマター（`pre.frontmatter`）にも届くが、`display: none` で表示されない。
- 届かないもの: インラインコード（段落、表、コールアウト、埋め込み）、`kbd`、数式、Source mode と Live Preview の本文のコード。
- `.markdown-rendered` の中に、`.cm-inline-code`・`.cm-math`・`.formula-editor`・`.markdown-source-view` は 1 つもなかった。
- 前と後の比較:
  - SD: 全ノート・全ビューで、変わった要素は 0。
  - KD: 変わったのは、届く要素と、sh の 3 規則が塗る 8 つの span（punctuation 6、file-descriptor 1、for-or-select 1）だけ。どれも color（と currentColor の border・text-decoration）が rgba(197, 201, 197, 0.9) → rgb(200, 192, 146)。

## 確かめていないこと

- SD のホバーのプレビュー: 3 回とも開かず、測れていない。KD は開いて測れた。規則はテーマで共通。
- `.formula-editor`（Bases の式の編集欄）: 開いていないので、どこに出るかは確かめていない。開いた画面での測定はしていない。
- Live Preview の要素の数が前と後で少し違う（SD の `C1 probe.md` は 255 と 245、`Code blocks.md` は 1195 と 1193）。両方にある要素だけを比べた。
- 計算された色だけを比べた。画面のピクセルは比べていない。
