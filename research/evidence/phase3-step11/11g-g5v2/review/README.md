# G5 v2 の目視と、フォーカスの失敗の分析

`*-v2-regions.png` と `*-v2-top.png` は `python3 -I tests/visual/g5-overlay.py <撮影の出力> <この場所>` で作った。`review-montage.png` は 8 枚を縮小して並べたもの。

- マゼンタ: `pair.titlebar`（x 722.38〜906pt、y 4〜26pt）と区画の線
- 緑: `pair.tab`（同じ列、y 34〜66pt）と区画の線
- 水色: v1 の左のタブ帯（診断用）

## 目視（7 枚。after・SD・translucent を除く）

- 窓は撮影の矩形と一致し、隔離インスタンスの窓だけが写っている。通知・ほかの窓・個人の情報はない。
- タイトルの文字は x 482〜717pt にあり、測定の領域（722.38pt から）に入っていない。
- 中央のタブ帯の右の「∨」のボタンは x 913〜922pt にあり、領域（906pt まで）に入っていない。
- 窓のボタン（左端）と右上の丸い角は、領域から外れている。
- 2 つの帯は同じ列を測っている。

## after・SD・translucent（1 枚目、INVALID）

- 画像の全体が背景の灰色（RGB 128）だけで、Obsidian の窓が写っていない。
- 記録（`after/measurements/obsidian-solarized-dark-translucent-gray-active-after.json`）では、`focusStep` も `afterShot` も `focused: false`。
- 計算値のタイトルバー・frame・窓の大きさは期待どおり（`G5v2run.log` の 1 行目）。DOM の上では窓は正しく用意されていた。
- 8 枚は 1 つの隔離インスタンスでテーマを替えながら撮る。この 1 枚は、インスタンスを起動した直後の 1 枚目。2 枚目以降の 7 枚は、すべてフォーカスがあり、窓が写っている。v1 の実行では、同じ 1 枚目にフォーカスがあった。
- したがって、背景の窓が前に出たあと、`obsidian-focus.js`（`app.focus({ steal: true })`・`moveTop`・`focus`）で隔離インスタンスの窓を前に出せなかった。判定は、この 1 枚を正しく INVALID とした。
- 前に出せなかった理由は、既存のデータからは特定できない。起動の直後の最初の呼び出しだったことは事実だが、それが原因かは確かめていない。
