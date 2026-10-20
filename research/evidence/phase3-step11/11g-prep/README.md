# 工程 11G の準備: `qd1.mobile-drawer-header` の判定の方法（2026-10-20）

[14](../../../14-implementation-plan.md) §6.61.5 の証拠。

- 実機・Inkdrop・普段の Vault・macOS の表示設定には触れていない。
- Obsidian は隔離インスタンス（E39、Obsidian 1.14.4）だけで、phone のエミュレーション（390×844）で動かした。
- ファイルの中のローカルのパスは `<scratch>` などに置き換えた。

| ファイル | 内容 |
|---|---|
| `drawer-header-self-test.txt` | 合成画像の陰性テスト（`tests/device/drawer-header-self-test.py`）11 件。すべて宣言どおり |
| `emulation/` | 隔離インスタンスの phone のエミュレーションで、両テーマ × 左右のドロワーを開いた画像。手順は `geo-emu.mjs` |
| `step10-shots/` | 工程 10 の実機の画像（`../../phase3-step10/device-run2/shots/` の 03・04・22・23）での試し。**旧いキットの参考で、検証には数えない** |
| `kit/` | ツアーで位置を記録するキットの自己テスト。組み立て 34、プラグイン 63、phone の dry run 6、tablet の dry run 9 がすべて PASS |

## `emulation/`

- `geometry.json`: `tests/device/drawer-geometry.js` の出力。ヘッダーの矩形と描画（背景は透明、`backdrop-filter` なし）、`headerArea`、`bodyArea`（CSS px）。
- `sheet.png`: 4 枚の画像に領域を重ねたもの。マゼンタがヘッダー、緑が本体。
- `judged.json`: `tests/device/drawer-header.py` の結果。4 件とも PASS で、dE2000 は 0.008〜0.056。

## `step10-shots/`

- 工程 10 のツアーは位置を記録していないので、領域は手で置いた（`left.json`・`right.json`）。
- 画像は 16 ビットの PNG。`judged.json` は 4 件とも PASS（dE2000 0.02〜0.04、標準偏差は最大 0.43）。

## `kit/`

- 自己テストのログ。dry run では、ドロワーの 4 段すべてが位置を記録したこと（`dry.drawer-geometry`）を確かめた。
- `tour-*.json`: phone の dry run のツアーの記録。各ドロワーの段の `measured.drawerGeometry` が入っている。
