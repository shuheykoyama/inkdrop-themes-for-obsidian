# 工程 5（UI の詳細）の証拠（2026-10-11）

[14](../../14-implementation-plan.md) §6.8 の証拠。すべて隔離した Obsidian（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。Inkdrop は操作していない。画像はない（Computed Style と、CDP で取得したフォントの情報だけ）。

## 環境

| 項目 | 値 |
|---|---|
| macOS | 26.5.2（工程 4 と同じ Mac） |
| Obsidian | アプリ 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`、インストーラ 1.11.7）と Electron 43.7.7（現行インストーラのコピー、`tests/runtime/current-installer.sh`） |
| テーマ | このリポジトリの `dist/<theme>/theme.css`（開発用の仮名称） |

## 1. V-36（`v36/`）

`tests/runtime/font-check.mjs` の結果。Inkdrop の引用符なしの宣言と、このテーマの引用符付きの宣言を当てた見えない span について、CDP の `CSS.getPlatformFontsForNode` が返した実際のフォント（family 名・PostScript 名・グリフ数）を比べた。各行に、宣言の種類（`font-name`・`page-font`・各フォント名の単独指定）、文字の種類（英字・和文・絵文字・記号）、両方の宣言、Computed Style、使われたフォント、一致したか（`same`）がある。

| ファイル | 結果 |
|---|---|
| `v36-electron-39.5.1.json` | 28 / 28 組が同じ |
| `v36-electron-43.7.7.json` | 28 / 28 組が同じ |

## 2. 実行時テスト（Computed Style、`runtime/`）

| ファイル | 内容 |
|---|---|
| `runtime-electron-39.5.1.json` / `runtime-electron-43.7.7.json` | `tests/runtime/run.mjs` の結果。545 件すべて PASS（うち 76 件は PASS（EMULATED））。各行に Electron の版・テーマ・プラットフォーム・外観（不透明 → translucent → 不透明）・状態・測定値・判定 |
| `self-test-electron-*.json` | ランナーの陰性テスト。219 件すべて宣言どおり |

メニュー・Popover・ツールチップは、CDP の Input による実際のポインタ操作（右クリック、hover、Meta + hover）で開いて測った。メニューは、測定の間だけテスト Vault の `nativeMenus` を無効にした（測定後に元に戻す）。
