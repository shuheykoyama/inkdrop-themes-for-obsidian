# 工程 6（Markdown の編集ビュー・閲覧ビュー）の証拠（2026-10-12）

[14](../../14-implementation-plan.md) §6.11 の証拠。すべて隔離した Obsidian（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。Inkdrop は操作していない。画像はテスト Vault の内容だけで、すべて目視で確認した。色の後処理はしていない。

## 環境

- macOS 26.5.2。Obsidian 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`）と 43.7.7（現行インストーラのコピー）。
- テーマ: このリポジトリの `dist/<theme>/theme.css`（開発用の仮名称）。
- 検証用ノート: `tests/fixtures/vault/Markdown elements.md`（見出し 6 段、強調、ハイライト、インラインコード、kbd、リンク 4 種、URL、タグ、脚注、引用、番号付き・箇条書きの 3 階層、タスク、表、水平線、コードブロック、Callout 5 種、画像、埋め込み、プロパティ）と画像 `half-transparent.png`（左半分が透明）。

## ファイル

| パス | 内容 |
|---|---|
| `runtime/runtime-electron-*.json` | `tests/runtime/run.mjs` の結果。各行にテーマ・プラットフォーム・外観（不透明 → translucent → 不透明）・状態（`md-source`・`md-live`・`md-reading`・`md-user-fonts` など）・測定値・判定 |
| `runtime/self-test-electron-*.json` | ランナーの陰性テスト |
| `native-<electron>/screenshots/` | ネイティブの撮影（`tests/visual/capture-obsidian.sh`、`CAPTURE_NOTE` などで検証用ノートを各モードで開く）。名前は `obsidian-<theme>-<opaque or translucent>-gray-active-<view>-<top or blocks>.png`。`top` は本文の段落から、`blocks` は表の後半から下を写す |
| `native-<electron>/measurements/` | 各撮影の条件、時刻、画像の SHA-256、フォーカスの状態、Electron の版 |
| `native-<electron>/top-left-corner.csv` | 工程 5 の左上隅の回帰検査（`tests/visual/configs/top-left-corner.json`）の測定値 |

撮影は色の正確さの証拠ではなく（それは Computed Style の実行時テスト）、表示の崩れ・塗り漏れの確認と、左上隅の回帰検査に使った。

## 結果

| | Electron 39.5.1 | Electron 43.7.7 |
|---|---|---|
| 実行時テスト | 1179 件 PASS（うち 124 件 PASS（EMULATED）） | 1179 件 PASS（同） |
| ランナーの陰性テスト | 301 件すべて宣言どおり | 301 件すべて宣言どおり |
| 左上隅（16 枚） | すべて ΔE2000 0.00 | すべて ΔE2000 0.00 |
