# G1 の事前準備の再レビュー対応: ドロワーのヘッダーの検査の完全性（2026-10-20）

[14](../../../../14-implementation-plan.md) §6.63 の証拠。

- 実機・Inkdrop・普段の Vault・macOS の表示設定には触れていない。
- 隔離インスタンス（E39、Obsidian 1.14.4）で、phone と tablet のエミュレーションを使った。
- `pymobiledevice3` は代役で、隔離インスタンスの窓を CDP で撮っただけ。端末には接続していない。
- ファイルの中のローカルのパスは `<scratch>` などに置き換えた。

| ファイル | 内容 |
|---|---|
| `drawer-header-self-test.txt` | `tests/device/drawer-header-self-test.py` の 24 件（tour の 13 件を含む）。すべて宣言どおり |
| `dry-run/`、`dry-run-tablet/` | `kit-self-test.mjs dry-run` と `dry-run-tablet` の記録 |
| `timing.mjs`・`timing.txt` | ドロワーの 8 段で、撮影の時刻が、プラグインが幾何情報を取った開始時と終了時の間にあるかを調べたもの。エミュレーションでは時計が同じ。8 件すべて間にあった |

`dry-run/`・`dry-run-tablet/` の中身:

| ファイル | 内容 |
|---|---|
| `kst-*.log` | 自己テストのログ。phone 7 件、tablet 10 件が PASS |
| `cable-tour.txt` | 本物の `cable.mjs tour` の出力 |
| `cable-tour/shots.json` | 各段の撮影の記録。ドロワーの段には、撮影の直前・直後の `geometryBefore`・`geometryAfter` がある |
| `cable-tour/tour-*.json` | プラグインのツアーの記録。ドロワーの段には、開始時・終了時の幾何情報とその時刻がある |
| `cable-tour/*.png` | ドロワーの段の画像（4 枚） |
| `drawer-header.json`・`.txt` | `drawer-header.py --tour` の結果。4 件とも PASS |
| `kit-self-test.json` | 自己テストの結果 |
