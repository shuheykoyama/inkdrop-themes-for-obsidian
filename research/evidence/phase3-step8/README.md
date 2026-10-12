# 工程 8（コードブロック・シンタックスハイライト）の証拠（2026-10-12）

[14](../../14-implementation-plan.md) §6.17 の証拠。Obsidian はすべて隔離したインスタンス（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。Inkdrop は起動していない（V-31 は展開済みの Inkdrop 6.1.5 の app.asar に同梱のコードを Node で読み込んで実行した）。画像はテスト Vault の内容だけで、すべて目視で確認した。色の後処理はしていない。

## 環境

- macOS 26.5.2。Obsidian 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`）と 43.7.7（現行インストーラのコピー）。
- テーマ: 工程 8 の `dist/<theme>/theme.css`（開発用の仮名称）。検証用ノート: `tests/fixtures/vault/Code blocks.md`（12 言語と、フェンス名の別名 9 個）。
- Inkdrop 側: Inkdrop 6.1.5（arm64）の `renderer/assets`、`inkdropapp/css@add48d9` の `syntax.css`。

## ファイル

| パス | 内容 |
|---|---|
| `v31-inkdrop-token-table.txt` | Inkdrop の tokenHighlighter（Lezer のタグ → `tok-*`）。本体 JS から抽出 |
| `v12-v31-correspondence.csv` | 言語・テキストごとの対応表: Inkdrop のクラスと色の変数、Obsidian の Source mode・Live Preview・Reading view のクラス（`tests/visual/token-table.mjs`） |
| `fidelity.csv` | ビュー・言語・テーマごとの、Inkdrop と同じ色のランの数（デスクトップ・不透明。`tests/visual/syntax-report.nu`） |
| `not-reproducible.csv` | Inkdrop の色にならないランの一覧（ビュー・言語・テキスト・Inkdrop のトークン・Obsidian の要素・テーマが選んだトークン・差の出るテーマ） |
| `runtime/runtime-electron-*.json` | 実行時テスト（`syn.*` を含む全検査） |
| `runtime/self-test-electron-*.json` | ランナーの陰性テスト（`syn.self-test` を含む） |
| `native-39.5.1/`、`native-43.7.7/` | ネイティブの撮影（各 40 枚）: 両テーマ × Source mode・Live Preview・Reading view × 6 か所（JS・Python・CSS・Shell・Rust・SQL のブロックを先頭に）の不透明、translucent の Source mode・Reading view（JS）。`top-left-corner.csv` に左上隅の検査（全枚 PASS）。撮影時にユーザーの許可でディスプレイを起こし、撮影の間だけスクリーンセーバーの開始を無効にした（撮影後に元の 600 秒へ戻した） |

`fidelity.csv` と `not-reproducible.csv` は Electron 43.7.7 の結果から作った（39.5.1 と同じ値）。
