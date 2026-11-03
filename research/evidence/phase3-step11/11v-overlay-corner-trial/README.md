# コマンドパレットとメニューの角丸の試験（隔離クローン、2026-11-04、画面は使っていない）

[14](../../../14-implementation-plan.md) §6.186 の証拠。**製品の CSS（`src/`・`dist/`）、検査、基準は変えていない。** 試験の CSS は、`d47e7b4` のスクラッチのクローンで作り（`trial.patch`）、静的検査と `npm test` だけを行った。GUI での確認は、ユーザーの許可を待つ。

## 試験の CSS（`src/common/components/overlays.css` の末尾に 3 規則、SD・KD 共通）

```css
.theme-dark:not(.is-mobile) .prompt { border-radius: 24px; }
.theme-dark:not(.is-mobile) .prompt .suggestion-item { border-radius: 7px; }
.theme-dark:not(.is-mobile) .menu { border-radius: 15px; }
```

| 対象 | セレクタ（詳細度） | Obsidian の今 | 試験後（予測） | Inkdrop 6.3.0 の実測 |
|---|---|---|---|---|
| コマンドパレットの外枠 | `.theme-dark:not(.is-mobile) .prompt`（0,3,0。Obsidian の `.prompt` は 0,1,0） | 12px | 24px | 24px |
| パレットの行（選択行を含む） | `… .prompt .suggestion-item`（0,4,0） | 4px | 7px | 7px |
| メニューの外枠 | `.theme-dark:not(.is-mobile) .menu`（0,3,0） | 8px | 15px | 15px |

値は SD・KD で同じ。**試験後の値は CSS から求めた予測で、まだ測っていない**（Obsidian を動かす GUI が要る）。

## 設計の判断

- **グローバルな変数は変えない**: `--radius-*`（すべてのオーバーレイが読む）、`--menu-radius`（`app.css` では `.menu` のほかに `.graph-controls` も読む）、`--shadow-*` は触れない。対象の要素の `border-radius` だけを指定する。
- **デスクトップだけ**: `:not(.is-mobile)`。モバイルのプロンプトとメニューは Obsidian 本来の見た目のまま。選択子は `.theme-dark` で始まる（静的検査 S4）。`!important` なし、詳細度は最小限。
- **パレットの行**: `.prompt .suggestion-item` に限る（エディタの補完の `.suggestion-item` は対象外）。
- **クリッピング**: `.prompt`・`.menu` はどちらも `overflow: hidden`（`app.css`）なので、外枠の角丸が内側の行・項目を切る。メニューの先頭・末尾の項目の hover の背景の角は、半径 15px の弧に対して約 0.5px はみ出して切られる見込み。GUI で確かめる。

## 見送った変更（理由）

- **影**: Inkdrop のパレットの影（`0 10px 30px` の 30% の黒）とメニューの影（40/20/10% の 3 層）は、Inkdrop の app の CSS の**リテラル**で、パレットのトークンではない。共通の CSS に黒の `hsl(var(--hsl-black) / 30%)` などを書くと、静的検査 S1・S4（パレットの外の色のリテラルの禁止）に落ちる（試して確認した）。既存のパレットの `--ink-floating-shadow` は Inkdrop の実測の影と別のもの。**残る差**: Obsidian のメニューの影（`0 1px 2px .12`、`0 3.4px 6.7px .18`、`0 15px 30px .3`）には Inkdrop の `0 8px 12px` 〜 `0 10px 30px` に近い層があり、差は小さい。一方、**Obsidian のプロンプトの影**（`--shadow-l`、`0 1.8px 7.3px .07`、`0 6.3px 24.7px .11`、`0 30px 90px .2`）は、Inkdrop（`0 10px 30px .3`）より広く淡い。影を合わせるには、S1 の例外（許可リストの新設）などが要り、設計の判断になる。今回は見送り、レビューで要否を決める。
- **選択行・選択項目の文字色**: SD の実測の `rgb(168,219,255)` は、SD のパレットのどの `--ink-*` にも対応がない（探した）。KD の実測は `rgb(197,201,197)` で、通常の文字色と同じなので変更不要。Inkdrop の `--selection-list-active-color` はパレットにないトークンで、パレットを変えない方針に反するので、見送り。ユーザー指定のアクセントとの優先関係の検討は、この理由で不要。
- **メニューの背景色**: Obsidian の `--menu-background` は `--ink-menu-background`（SD `rgb(0,20,26)`、KD `rgb(13,12,12)`）で、**Inkdrop 自身の `--menu-background` の値と同じ**。G8 で測った Inkdrop の `rgb(0,33,41)` は、ノートの見出しの Status の in-app のドロップダウンが使う `--inline-dropdown-menu-background-acrylic` で、別の部品。対応は妥当なので、変更しない。
- メニューの項目の高さ・余白・全体の大きさ、パレットの行の高さ・余白、ボタンの押下・focus、通知、モーダル、環境設定、Popover、Ribbon、Canvas、Graph: 変更しない（レビューの指示）。

## 検査（隔離クローン）

- CSS のビルド: 通った。`dist` の差は、SD・KD とも、末尾への上の 3 規則とコメントだけ（SD 138,360 → 139,304 バイト、KD 144,077 → 145,021）。
- 静的検査（S1〜S5、stylelint を含む）: 全部通る。`npm test`: 終了コード 0（g7 の自己テスト 84 件まで）。
- 変更の範囲: 1 ファイル、18 行の追加。ほかの規則の変更・削除なし。

## 副作用の見込み（未確認。GUI で確かめる）

- `.menu` は、ファイル・タブ・エディタなどのコンテキストメニューと、メニューを開くボタン（「…」）のメニューに使われる。どれも角丸だけが変わる。ネイティブのメニュー（macOS の既定）は OS の描画で、このテーマの CSS は当たらない。
- 設定のドロップダウンは、macOS では OS の `select` なので対象外。
- Canvas のカードメニュー、Graph のコントロール（`--menu-radius`）は、この試験では変わらない（確認する）。

## GUI での確認（許可のあと。新しい基盤は作らない）

G8 の道具（`../11u-g8-6.3.0/tools/g8-drive.mjs`）を、試験ビルドのテーマで、隔離 Obsidian に対して SD・KD で再実行し、パレットとメニューの角丸の計算値と画像を、`../11u-g8-6.3.0/` の前の値と比べる。確認する点: 角丸が予測どおり（24 / 7 / 15px）、メニューの先頭・末尾の項目のクリッピング、選択行・hover・focus の視認性、キーボード操作とポインタ操作、ほかの UI（Graph のコントロール、Canvas のメニュー、設定、モーダル、通知）に変化がないこと。
