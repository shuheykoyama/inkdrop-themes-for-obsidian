# KD の C2 の部分統合（SQL・HTML・YAML・Markdown、2026-11-02）

[14](../../../14-implementation-plan.md) §6.158 の証拠。製品の CSS とオラクルを変えたコミットの、隔離した Obsidian 1.14.5（Electron 39.5.1）での確かめ。ゲートの入力は変えていない。

## 変えたもの

- `src/themes/kanagawa-dragon/syntax.css`（テーマの例外、§1.7）と、KD の入口の最後の `@import`。
  - Reading view の `code.language-sql` の素の文字 → `--ink-syntax-name-color`。
  - `code.language-html`・`yaml`・`yml`・`markdown`・`md` の素の文字 → `--ink-syntax-content-color`。
  - 規則のないトークンの span は `--code-normal` に戻す（詳細度は 1 クラス）。
- `tests/spec/syntax.json` の `reading.bare`（テーマ、言語、色）と、`tests/runtime/lib/syntax.mjs` のオラクル。オラクルは、要素のない文字（素の文字）にだけ言語の地の色を使い、規則のないトークンの span には使わない。
- Inkdrop の実測の基準（`tests/fixtures/inkdrop-rendered-6.2.0.json`）は変えていない。SD の `theme.css` はバイト単位で同じ（`run-window.txt`）。

## ファイル

| ファイル | 内容 |
|---|---|
| `runtime-electron-39.5.1.json`・`run.log` | すべての実行時の検査（`tests/runtime/run.mjs`）。exit 0 |
| `compare-runtime.txt` | C3 の回帰の 1.14.5 E39.5.1 の 1 回目との、検査ごとの比較（`../11i-c2-kd/c2-testnote.mjs`） |
| `probe-base.json`・`probe-c2.json`・`c2-elements.txt` | 要素の比較（`../11i-c2-kd/c2-probe.mjs`、`../11g-g7/c1a/c1-compare.mjs`）。基準は `3756411` のクローンのビルド |
| `c2-testnote.txt` | テストのノートの文字と、実測の Inkdrop 6.2.0 の色 |
| `c2-general.txt` | 一般的なコード（`../11i-c2-kd/C2 general.md`）の文字と、静的な Inkdrop 6.2.0 の色 |

## 結果

- 実行時の検査: 3871 件で FAIL 0。Reading の `syn.reading.<言語>.impl` は 252 件すべて PASS（オラクルが新しい地の色に合っている）。
  - 状態が変わったのは、KD の `syn.reading.html`・`yaml`・`md` の fidelity の 18 件（DIFF → PASS・PASS (EMULATED)）だけ。DIFF の合計は 594 → 576。
  - KD の Reading の違う文字は 438 → 368（直った 70、外れた 0）。sql（42 → 10）と markdown（15 → 2）は DIFF のまま。SD と Source mode・Live Preview は変わらない。
- 要素: 変わったのは 13 個で、すべて対象の言語の `code` 要素。SD、ほかの言語、インラインコード、ふつうの Markdown、ほかのビューは 0。
- 文字: テストのノートは 1576 → 1646（+70、外れた 0）。一般的なコードは 1783 → 2179（+396、外れた 0）。色が変わって合わないままの文字は、どちらも 0。予測（§6.157）と同じ。

## 確かめていないこと

- E43.8.3、1.14.4、iPhone では測っていない（ゲートの入力の差し替えに要る新しい証跡は、まだない）。
- 画面の画素は比べていない。
