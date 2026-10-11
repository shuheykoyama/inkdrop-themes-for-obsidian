# translucent 時のウィンドウ左上隅の証拠（2026-10-12）

[14](../../14-implementation-plan.md) §6.10 の証拠。すべて隔離した Obsidian（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。Inkdrop は操作していない。画像はテスト Vault の内容だけで、16 枚すべてを目視で確認した。色の後処理はしていない。

## 環境と撮影条件

- macOS 26.5.2。Obsidian 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`）と 43.7.7（現行インストーラのコピー）。
- 撮影は `tests/visual/capture-obsidian.sh <theme> <opaque|translucent> gray active`（工程 4・V-38 と同じ条件: ウィンドウ 1200×700 pt を (400, 250)、灰色の背景ウィンドウ、`screencapture -x -R400,250,1200,700`）。各 `measurements/*.json` に撮影時刻・画像の SHA-256・フォーカスの状態・Electron の版を記録した。
- `before*`: 修正前のビルド（`translucent.css` に角の規則がない）。`after*`: 修正後のビルド。

## ファイル

| パス | 内容 |
|---|---|
| `{before,after}{39,43}/screenshots/` | 両テーマ × 不透明・translucent のネイティブの撮影 |
| `{before,after}{39,43}/top-left-corner.csv` | `tests/visual/configs/top-left-corner.json` の測定値（角の下部とタブ帯の同じ行） |
| `{before,after}{39,43}/s4-*.csv` | 工程 4 の 14 領域の測定値（`step4-*-gray-active.json`）。修正前後の比較で副作用がないことの確認に使った |
| `top-left-before-after-electron-39.5.1.png` | 左上 420 × 120 pt の切り抜き（拡大なし、2 倍の画素）。左が修正前、右が修正後。上から SD translucent、SD 不透明、KD translucent、KD 不透明 |
| `runtime/runtime-electron-*.json` / `self-test-electron-*.json` | 修正後の実行時テスト（553 件 PASS）とランナーの陰性テスト（229 件宣言どおり） |
| `runtime/runtime-prefix-build-electron-43.7.7.json` | 修正前のビルドでの実行時テスト。追加した角の検査の translucent 2 件が FAIL（`rgba(0, 0, 0, 0)`）し、検査が不具合を検出できることを示す |

## 結果（角とタブ帯の ΔE2000、閾値 1.0）

| | SD 不透明 | SD translucent | KD 不透明 | KD translucent |
|---|---|---|---|---|
| 修正前 39.5.1 | 0.00 | 12.34 | 0.00 | 8.95 |
| 修正前 43.7.7 | 0.00 | 11.71 | 0.00 | 7.96 |
| 修正後 39.5.1 | 0.00 | 0.00 | 0.00 | 0.00 |
| 修正後 43.7.7 | 0.00 | 0.00 | 0.00 | 0.00 |
