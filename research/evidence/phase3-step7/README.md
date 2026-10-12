# 工程 7（エディタ周辺 UI と Q-D23）の証拠（2026-10-12）

[14](../../14-implementation-plan.md) §6.15 の証拠。すべて隔離した Obsidian（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。行番号はテスト Vault の `showLineNumber` で切り替え、元に戻した。Inkdrop は操作していない（V-35 は未実施）。画像はテスト Vault の内容だけで、すべて目視で確認した。色の後処理はしていない。

## 環境

- macOS 26.5.2。Obsidian 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`）と 43.7.7（現行インストーラのコピー）。
- テーマ: 工程 7 の `dist/<theme>/theme.css`（開発用の仮名称）。検証用ノート: `tests/fixtures/vault/Editor chrome.md`。

## ファイル

| パス | 内容 |
|---|---|
| `runtime/runtime-electron-*.json` | 実行時テスト（1699 件、両 Electron で PASS） |
| `runtime/self-test-electron-*.json` | ランナーの陰性テスト（377 件、両 Electron で宣言どおり） |
| `native-39.5.1/`, `native-43.7.7/` | 各 Electron の撮影 14 枚: 両テーマ × Source・Live Preview × 不透明・translucent（`*-q23`、行番号あり、カーソルは「Second paragraph」の行）、選択（`*-source-select`）、検索（`*-source-search`）、行番号なし（`*-live-nolines`）。`q23/` に `tests/visual/q23-check.nu` が作った領域の設定と測定値、`top-left-corner.csv` に左上隅の検査 |
| `native-39.5.1-trial/` | 通しの撮影の前に同じ CSS で撮った SD・KD の Source mode（不透明）と Q23-5 の測定（上の撮影と同じ値） |
| `native-39.5.1-no-gap-fill/` | 陰性: ガターと本文の隙間を塗る規則だけを外した CSS で撮った SD・KD。Q23-5 が FAIL する |
| `v30-compare/` | V-30 の状態 4（Inkdrop、行番号とアクティブ行あり、CDP の 1 倍）と Obsidian の撮影を並べた画像（`tests/visual/side-by-side.py`）。構造だけを見るためのもので、色は比べない |

## 撮影の経緯

最初の通しの実行は途中でディスプレイがスリープして失敗した（ディスプレイを起こす・ロックを解く操作はしていない）。同日、ユーザーが画面を点けた状態で全撮影をやり直した。その際、「検索」の撮影の検索バーが後続の撮影に残る不具合を目視で見つけ、`tests/visual/obsidian-capture-setup.js` を直して全撮影を撮り直した（ここにあるのは直した後の撮影）。

## Q23-5 の結果（ΔE2000、閾値 1.0。Electron 39.5.1・43.7.7 とも同じ値）

| 撮影 | ガター / 隙間 / 行の期待色との差（Q23-5a） | ガター｜隙間、隙間｜行（Q23-5b） |
|---|---|---|
| SD Source・Live Preview、不透明 | 0.26 / 0.26 / 0.22 | 0.00 / 0.32 |
| SD Source・Live Preview、translucent | 期待色なし（面が素材で決まる） | 0.00 / 0.32 |
| KD Source・Live Preview、不透明 | 0.77 / 0.77 / 0.22 | 0.00 / 0.56 |
| KD Source・Live Preview、translucent | 期待色なし | 0.00 / 0.56（43.7.7 は 0.55） |
| 陰性: 隙間を塗らない SD / KD（39.5.1） | 隙間 2.04 / 1.09 で FAIL | 1.97・1.85 / 1.37・1.12 で FAIL |

左上隅の検査（`top-left-corner.csv`）は各 Electron の 14 枚すべてで差 0.00。
