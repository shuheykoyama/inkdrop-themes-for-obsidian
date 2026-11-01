# Q-D13 の残る差の分類（2026-11-01）

[14](../../../14-implementation-plan.md) §6.145 の証拠。CSS・期待値・許容差・Q-D は変えていない。アプリは動かしていない。

## ファイル

- `qd13-residual.mjs`: 分類の道具。`node qd13-residual.mjs <runtime-*.json> [platform] [appearance]`。分類の定義は先頭のコメント。
- `residual-1.14.5-e39-desktop.txt`: 主な結果（`11g-g7/c3/regress/1.14.5/runtime-electron-39.5.1-run1.json`、デスクトップ・不透明）。違う run ごとの分類、色を変えると動くグループ（合う・外れる文字数と Inkdrop の色の内訳）、言語ごとの集計。
- `residual-iphone.txt`: iPhone（`11g-g7/iphone-c3/device/report.json`、phone・不透明）。合計はデスクトップと同じ。
- `totals-other-runs.txt`: 1.14.4（E39.5.1・E43.7.7）と 1.14.5（E43.8.3）の合計。どれも同じ。
- `contrast.txt`: C2 の候補の色のコントラスト比と色の差（計算）。

## 要点

- DIFF の検査 SD 48、KD 51（ゲートと同じ）。違う文字は SD 1868、KD 1650。
- 約 6 割は、今のクラスでは分けられない差（DOM の制約）。失うものなしに CSS で直る文字は 0。
- C2 の上限（テストのノート）: SD +87（根拠の不足を含めて +169）、KD +199（css を含めて +213）。理論上の上限で、実装して確かめたものではない。
- SD の C2 の候補（変数名の色）は、コードの背景とのコントラスト比が 5.04 → 3.53 に下がる。
