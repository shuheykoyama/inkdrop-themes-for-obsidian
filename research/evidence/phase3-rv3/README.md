# RV3 の追加対応の証拠（2026-10-12）

[14](../../14-implementation-plan.md) §6.13 の証拠。Obsidian はすべて隔離したインスタンス（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。Inkdrop は操作しておらず、比較には保存済みの V-30 の画像（`../phase2-p0/inkdrop/`）を使った。画像はテスト Vault の内容だけで、すべて目視で確認した。色の後処理はしていない。

## 環境

- macOS 26.5.2。Obsidian 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`）と 43.7.7（現行インストーラのコピー）。
- テーマ: RV3 の修正後の `dist/<theme>/theme.css`（開発用の仮名称）。検証用ノートは工程 6 と同じ（`tests/fixtures/vault/Markdown elements.md`）。

## ファイル

| パス | 内容 |
|---|---|
| `runtime/runtime-electron-*.json` | 実行時テスト（1267 件、両 Electron で PASS） |
| `runtime/self-test-electron-*.json` | ランナーの陰性テスト（317 件、両 Electron で宣言どおり） |
| `native-<electron>/screenshots/` | ネイティブの撮影（両テーマ × Source・Live Preview・Reading × 本文側と表の後半、Live Preview と Reading は translucent も）。名前の規則は `../phase3-step6/README.md` と同じ |
| `native-<electron>/measurements/` | 各撮影の条件、時刻、SHA-256、フォーカス、Electron の版 |
| `native-<electron>/top-left-corner.csv` | 工程 5 の左上隅の回帰検査（16 枚すべて ΔE2000 0.00） |
| `v30-compare/` | V-30 の Inkdrop の画像（左）と Obsidian の撮影（右、Electron 43.7.7）を並べた画像。`tests/visual/side-by-side.py` で作成 |

## 並べた画像の扱い

左は CDP のスクリーンショット（1 倍）、右はネイティブの撮影（2 倍を 1 倍に縮小）で、撮影方式と色空間が違う。また中身のノートも違う。このため色の数値は比べず、構造・重なり・装飾・不自然さだけを見た。色の値は一次資料と Computed Style（実行時テスト）で検証している。結果は 14 §6.13 の表（PASS / DIFF / UNVERIFIED）。

| 画像 | 左（Inkdrop） | 右（Obsidian） |
|---|---|---|
| `{sd,kd}-editor-vs-source.png` | エディタ（V-30 の状態 1） | Source mode（本文側、表の後半） |
| `{sd,kd}-editor-vs-live.png` | エディタ（同） | Live Preview（同） |
| `{sd,kd}-preview-vs-reading.png` | プレビュー（V-30 の状態 5） | Reading view（同） |
