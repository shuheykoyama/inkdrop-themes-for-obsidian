# C2 の試験の実装（Kanagawa Dragon だけ、2026-11-01）

[14](../../../14-implementation-plan.md) §6.151 の証拠。**製品の CSS（`src/`・`dist/`）、期待値（`tests/spec/syntax.json`）、ゲートの入力は変えていない。** 試験の CSS は、スクラッチのクローンでだけ当てた。

## 何をしたか

- 試験の CSS（`c2-kd.css`）: Reading view の js・javascript・ts・typescript・python・go・sql・html・yaml・yml・markdown・md のコードブロックで、Prism がトークンにしない文字を、Inkdrop がその言語で使う色にする（変数名、SQL の名前、HTML・YAML・Markdown の内容の色）。KD ではどれも rgb(197, 201, 197)。
  - 規則のないトークンの span は、前と同じコードの文字の色に戻す。詳細度は 1 クラスなので、このテーマと Obsidian のトークンの規則（2 クラス以上）が必ず勝つ。
  - `py` は対象外にした。Inkdrop 6.2.0 は `py` を言語名と見なさず、色を付けない（§6.131）。Inkdrop の言語の一覧（同梱のコードを読んだ）で、名前か別名として読まれるのは、`js`・`javascript`・`ts`・`typescript`・`python`・`go`・`sql`・`html`・`yaml`・`yml`・`markdown`・`md`（ほかに `ecmascript`・`node`・`xhtml`・`mkd`・`gfm`。Prism が読まないので対象外）。
- 当て方: `3756411` のクローンに、`c2-kd.css` を `src/common/components/c2-kd-trial.css` として置き、KD の入口の最後で読み込む（`trial.patch`）。静的の検査は「テーマの入口は `@import` だけ」なので、入口には置けない。クローンの `npm test` は exit 0。SD の `theme.css` は、試験の前後でバイト単位で同じ。
- 隔離した Obsidian 1.14.5（Electron 39.5.1、C3 の回帰の基準と同じ環境）で、次を測った。時刻とビルドは `run-window.txt`。

## ファイル

| ファイル | 内容 |
|---|---|
| `C2 general.md` | 一般的なコードのノート（テストのノートの外）。試験の 13 ブロック（変数・関数・型・リテラル・演算子を含む）、対照の css・rust・sh・json、言語のないブロック、インラインコード、コールアウトの中の js |
| `c2-probe.mjs` | `../11g-g7/c1a/c1-probe.mjs` の写し。4 つのノート（C1 probe、Code blocks、Markdown elements、C2 general）× 3 ビュー × 2 テーマで全要素の計算値を記録し、Reading の `Code blocks.md` と `C2 general.md` は文字ごとの色も記録する |
| `probe-base.json`・`probe-trial.json` | 基準と試験の probe の結果。最初の 1 組は `Code blocks.md` の文字を記録していなかったので捨てた（`C2 general.md` の数は同じだった） |
| `c2-elements.txt` | 要素の比較（`../11g-g7/c1a/c1-compare.mjs`） |
| `c2-general.mjs` | 文字ごとの比較。`static`（Inkdrop の同梱のパーサーでの静的な色）か、`rendered`（G7-1 で実測した Inkdrop 6.2.0 の色）と比べる |
| `c2-testnote.txt` | テストのノート（`Code blocks.md`）の文字。Inkdrop 6.2.0 の**実測の**プレビューの色と比べた |
| `c2-general.txt`・`inkdrop-tokens-general-6.2.0.json` | 一般的なコードの文字。Inkdrop 6.2.0 の同梱のパーサーで求めた**静的な**色と比べた（`tests/visual/inkdrop-tokens.mjs`） |
| `c2-testnote.mjs`・`runtime/` | 試験のビルドでの実行時の検査（`tests/runtime/run.mjs`、2 回）と、C3 の回帰の 1.14.5 E39.5.1 の 1 回目との、検査ごとの比較 |

## 結果

- **要素**（`c2-elements.txt`）: 変わった要素は 35 個で、すべてが試験の言語の `code` 要素（rgb(200, 192, 146) → rgb(197, 201, 197)）。トークンの span、`py`、対照の言語、言語のないブロック、インラインコード、ふつうの Markdown、Source mode は 0。Live Preview で変わったのは、コールアウトと埋め込みの中の、描画されたコードブロック（Reading と同じもの）だけ。SD は 0。
- **テストのノート**（実測の Inkdrop 6.2.0 と比べた、空白以外の 2014 文字）: KD は 1576 → 1777。直った 201、外れた 0。
  - 予測（§6.145.3: +199・−2）との差: 言語ごとの増え方は予測と同じ。予測の −2 は `py` のブロックの文字で、`py` を対象外にしたので外れなかった。python の +42 は、予測の +40（差し引き）に、この 2 を足したもの。
  - 色は変わったが、合わないままの文字が 30（プロパティ名 20、型名などの定義 10）。
- **一般的なコード**（静的な Inkdrop の色と比べた、空白以外の 2984 文字）: KD は 1783 → 2537。直った 754、外れた 0。
  - 合わないままで色が変わった文字が 122。うちプロパティ名の 96 文字は、Inkdrop の色 rgb(195, 177, 136) から遠ざかる（ΔE2000 5.5 → 15.7）。関数名と型名の定義の 26 文字は近づく（25.7 → 14.4）。
  - `py` のブロックは 78 文字中 11 文字しか合わない（試験の前から。Obsidian は Prism の Python で色を付け、Inkdrop は色を付けない）。C2 とは別の差。
- **実行時の検査**（試験のビルドで 2 回）: 状態が変わったのは、KD の `syn.reading.<試験の言語>.impl` の 66 件（PASS・PASS (EMULATED) → FAIL）。期待値（オラクル）を変えていないため、素の文字の色がオラクルと違うことを示すもので、試験の CSS が当たっていることの確かめになる。
  - 1 回目だけ、KD の `md.reading.h1-rule-width`・`h2-rule-width`（opaque (after translucent)）が FAIL（2px が 1.83px、1px が 0.91px。比は同じ 0.913）。2 回目は PASS。試験の CSS はコードの色だけを変えるので、関係はないと見ているが、原因は確かめていない。
  - `syn.*.fidelity` の DIFF は変わらない。この検査はオラクルの色を Inkdrop の色と比べるので、オラクルを変えない試験では動かない。そのため、テストのノートの改善は、上の文字ごとの比較で測った。
- **読みやすさ**: Reading のコードの背景とのコントラスト比は 9.48 → 10.42（`../11h-qd13/contrast.txt`）。

## 確かめていないこと

- 一般的なコードの Inkdrop の色は静的な求め方で、Inkdrop での実測ではない。markdown・md は、Inkdrop が自前の設定の Markdown のパーサーを使うので、静的な色と違うことがある（§6.125.2）。
- 実機（iPhone）、E43.8.3、1.14.4 では測っていない。画面の画素は比べていない。
- 1 回目の rule-width の FAIL の原因。
