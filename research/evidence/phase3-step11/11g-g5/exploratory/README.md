# G5 の事後の探索的な分析（2026-10-21）

[14](../../../../14-implementation-plan.md) §6.81 の証拠。

- **G5 の判定ではない。** 結果を見たあとに方法を調べたものなので、ここの値を検証の結果として使わない。G5 の正式の判定は INVALID のまま。
- 使ったのは、既存の 8 枚の撮影とその記録だけ。追加の撮影、Obsidian の起動、画面の操作はしていない。
- 原本（`../after`、`../before`）は変えていない。`explore.py` は、読む前に各画像の SHA-256 を記録と照合する。
- 画像の読み取りと色の差は、`tests/visual/sample-regions.py` のもの。numpy で測った平均が、判定に使った領域で `stats()` と一致することを確かめている。

| ファイル | 内容 |
|---|---|
| `explore.py` → `exploratory.json` | A: 窓の角の測定と、それを除く規則。B: ばらつきの内訳（列の平均・行の平均・残り）、内側に縮めたときの標準偏差、8pt 四方の区画。C: タイトルバー（角を除く）と左・中央のタブ帯の CIEDE2000、4 等分、上下の内側、除く幅の感度 |
| `corner-*.png` | 各画像の右上の 64×32pt を 8 倍にしたもの。緑は判定に使った領域、マゼンタは角を除く線 |
| `ramp.py` → `ramp.txt` | タイトルバーの列ごとの明るさ（20pt ごと）と、変化が止まった後の区間（x ≥ 880pt）の値 |
| `same-column.py` → `same-column.txt` | 同じ列（x 722〜906pt）での、タイトルバーと、その真下の中央のタブ帯の比較 |

再実行: このフォルダで `python3 -I explore.py`、`python3 -I ramp.py > ramp.txt`、`python3 -I same-column.py > same-column.txt`（numpy と Pillow が要る）。
