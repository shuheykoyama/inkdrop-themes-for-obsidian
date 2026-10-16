# 工程 11D（視覚比較と残る差の一覧）の証拠（2026-10-16）

[14](../../../14-implementation-plan.md) §6.48 の証拠。Inkdrop の新しい操作・撮影はしていない（基準は既存の V-30・V-38）。Obsidian はすべて隔離インスタンス（専用の `--user-data-dir` とテスト Vault の複製）で、普段の Vault・設定・実機には触れていない。画像はすべて目視で確認した（テスト Vault の内容だけが写っている。個人情報なし）。色の後処理はしていない。

## 1. 不透明: V-30 と CDP 同士の比較（`cdp-e43/`・`cdp-e39/`、`v30-compare-*.csv`）

| 項目 | Inkdrop（基準） | Obsidian（今回） |
|---|---|---|
| 画像 | V-30 `evidence/phase2-p0/inkdrop/{sd,kd}-{1..5}-*.png`（2026-10-10、Inkdrop 6.1.5、Electron 43.7.1・Chrome 150） | `cdp-e43/screenshots/`（Obsidian 1.14.4、Electron 43.7.7・Chrome 150）、`cdp-e39/screenshots/`（Electron 39.5.1・Chrome 142） |
| 撮影方法 | CDP `Page.captureScreenshot`、`Emulation.setDeviceMetricsOverride` 1024×800・倍率 1、不透明 | 同じ（`tests/visual/capture-obsidian-cdp.mjs`。1 つの DevTools セッションで寸法を固定し、状態を作って撮る） |
| 状態 | 1 既定、2 ノートリストにフォーカス、3 サイドバーの行を hover、4 行番号・アクティブ行を有効にして「bold」を選択、5 プレビュー | 1 Live Preview（`1-live`）と Source mode（`1-source`）、2 File Explorer のリーフをアクティブ、3 File Explorer の行（Other note）を hover、4 Source mode・行番号あり・「bold」を選択、5 Reading view |
| ウィンドウ | フォーカスあり | 隔離ウィンドウを前面にしてフォーカス（`body.is-focused` がない撮影は失敗にして撮り直す） |

各画像の `measurements/*.json` に、撮影時刻、SHA-256、寸法、Obsidian・Electron・Chrome の版、モード、行番号、アクティブなリーフ、選択、`body` のクラスを記録した。

**測り方**（`tests/visual/v30-compare.py`、領域は `tests/visual/configs/v30-compare.json`）: 両方の画像の、背景だけの平坦な矩形の平均色を CIEDE2000 で比べる（不透明の CDP 同士なので画素を直接比べる）。各チャンネルの標準偏差が 1.0 を超える領域は平坦でないとして測定無効（FAIL）。閾値は ΔE2000 1.0（工程 4 と同じ。緩めていない）。組は Q-D1 の面の対応と、状態色の対応で作った（22 組 × 2 テーマ）。

**結果**（両 Electron とも同じ判定）:

| 判定 | 件数（各 Electron、2 テーマ） | 内容 |
|---|---|---|
| PASS | 42 | ΔE2000 は最大 0.61（0 でない組: アクティブ行 0.38〜0.59、フォーカスのバー 0.56〜0.61、E43 の KD の開いているファイル 0.59。どれも 8 ビットで 1 段の差）。領域の標準偏差は最大 0.5 |
| DIFF (decided) | 2 | File Explorer の行の hover（SD 1.97、KD 6.82）。§6.8 の判断 2 のとおり、Obsidian の既定の hover を残している（§4 の A1） |
| FAIL（新しい色の差・平坦でない領域・画像の欠落） | 0 | — |

面の組（Ribbon・左ドック・タブ帯・ステータスバー・アクティブタブ・View Header・エディタ・コードブロック・開いているファイル・フォーカスのバー・アクティブ行・ガター・Reading view とそのコードブロック）は、すべて Inkdrop の V-30 の画素と閾値内で一致した。

**陰性対照**: Obsidian の画像を SD と KD で入れ替えて比べると、42 組すべて FAIL になった（`v30-compare-swapped-themes-control.txt`。決めた差の 2 組だけは入れ替えても DIFF (decided)）。比較道具の陰性テスト（合成画像。同じ色は PASS、別の色は FAIL、境界・色の境目を含む領域は平坦でないとして FAIL、決めた差の組が一致したら FAIL、画像の欠落、1024×800 でない画像を拒否）は `visual-self-test.txt`（15 件、既存の 6 件を含む）。

**撮影で見つけた道具の問題**（テーマの問題ではない。直してから撮り直した）:

- 同じリーフでモードを何度も切り替えると、エディタが Markdown として解析されない状態になった（構文のクラスがなく、frontmatter の閉じ行が次の行に重なる）。撮影ごとにリーフを空にしてノートを開き直し、見出しの要素が出るまで待つ（出なければ失敗）ようにした。
- 撮影中にウィンドウのフォーカスや hover が外れることがあった（Mac を使っている人のポインタや操作）。`body.is-focused` がない撮影と、撮影の前後で行が `:hover` でない撮影は失敗にして撮り直す。一度、E43 の SD の状態 3 で、行が `:hover` なのに hover の背景が描かれていない画像が撮れた（原因は特定していない。この確認では検出できない）。撮影の後の確認を足して全 24 枚を撮り直し、最終の画像では hover の行の画素が両 Electron とも Obsidian の hover の色（SD (18, 59, 69)、KD (39, 38, 38)）であることを比較の値で確かめた。
- 状態 1〜3 では、カーソルを撮影範囲の外（最終行）に置いた（Q-D23 のアクティブ行が状態 1〜3 のエディタの面に被らないように）。ポインタは本文の右の余白に置いた。そのため、一部の画像の右端にスクロールバーが出ている（比べた領域の外）。

## 2. translucent: V-38 の再利用（`v38-reuse/`）

translucent はネイティブの撮影同士でしか比べられない（CDP は macOS の素材を合成しない）。ネイティブの合成は撮影の時刻で変わる（§6.6: 前日の V-32 と ΔE2000 最大 3.2）ため、Inkdrop と Obsidian を**同じ時刻に**撮った V-38（2026-10-11、灰色・アクティブで 14 組すべて ΔE2000 0.00）を基準のまま使い、新しいネイティブ撮影はしていない（Inkdrop の撮影は承認されていない。Obsidian だけ撮り直しても、比べる相手が別の時刻になる）。

V-38 の結果が今のテーマにも当てはまることを、次の 2 つで確かめた。

| 確認 | 方法 | 結果 |
|---|---|---|
| 測った面の描画が V-38 の時から変わっていない | V-38 のコミット `52434a5` の生成物と現在の生成物を、隔離インスタンス（E43、translucent 有効、V-38 と同じウィンドウの配置）で順に読み込み、V-38 の Obsidian の 7 領域（各 3 点）で、点の下の要素から祖先までの `background-color`・`background-image`・`opacity`・`backdrop-filter`・`mix-blend-mode`・`box-shadow` を取った（`v38-reuse/*-v38.json`・`*-head.json`） | 両テーマとも完全に一致。陰性対照として SD と KD の同じ取得を比べると一致しない（値を拾えている）。面の値は Inkdrop の acrylic の宣言（例: SD の Ribbon `rgba(0, 45, 56, 0.5)`、ドック `rgba(0, 33, 41, 0.7)`、エディタ `rgba(0, 33, 41, 0.9)`） |
| V-38 の測定が今の道具でも同じ | 保存済みの V-38 の 12 枚を `sample-regions.py`・`v38-compare.py` で測り直した | 保存済みの CSV とバイト単位で一致。灰色・アクティブは 14 組すべて PASS（柄の背景は V-38 と同じく測定無効、記録のみ） |

## 3. 新しく見つかった差: Source mode のリンクの下線（修正済み、`link-underline/`）

V-30 の状態 1（SD）を Source mode の撮影と並べて見たとき、Inkdrop ではリンクの文字と括弧（`[link]`）と `[Other note]` に下線があるのに、Obsidian の Source mode では URL にしか下線がないことに気づいた（`before-after-sd.png`）。

| 項目 | 内容 |
|---|---|
| 原因 | テーマの CSS。Inkdrop のエディタは `.tok-link` に `--syntax-link-text-decoration`（両テーマ `underline`）を当てる。テーマはこのトークンをパレットに持っていたが、どの規則も使っていなかった。Obsidian は Live Preview でだけリンクに下線を引き（`.cm-underline`）、Source mode の `.cm-link`・`.cm-hmd-internal-link` には装飾がない。検査（`qd4.links`。説明は「editor = --syntax-link-color (underlined)」）は Live Preview の下線しか測っていなかった |
| 重要度 | 中（目に見える装飾の差。必須項目 `qd4.links` の Source mode の部分が崩れていた。色は正しい） |
| 処置 | **修正**（確定した判断の範囲内: Q-D4、工程 6 の「Inkdrop の `.tok-link` のように下線」）。`components/markdown.css` に、Source mode（`:not(.is-live-preview)`）の `.cm-link` と `.cm-hmd-internal-link` へ `text-decoration-line: var(--ink-syntax-link-text-decoration)` を足した。脚注・定義のない `[text]`（`.cm-hmd-barelink`）と、コードブロックの中の Markdown（`.cm-hmd-codeblock`）は除いた（Inkdrop で下線が付くと確かめていない）。Live Preview は変えていない |
| 影響の確認 | テスト Vault の全ノートの Source mode の全 span で、規則の有無による `text-decoration-line` の差を取った（`underline-diff.json`）。変わるのは Markdown リンクの括弧と文字、Wiki リンクの文字だけ（除外の前は脚注・`[square]`・コードブロック内の `[link]` も変わっていたので、範囲を絞った）。除去実験（`underline-removal.json`）: 規則があると `underline`、外すと `none`。Live Preview はどちらでも同じ |
| 検査 | 実行時の検査を 3 件追加（`md.source.link-text-underline`・`md.source.link-mark-underline`・`md.source.internal-link-underline`、`qd4.links`）。陰性テストを 2 件追加（Wiki の括弧 `[[` と脚注に下線を期待すると FAIL。要素がないためでなく、測った値 `none` で FAIL になることを確認）。lint の warning（`text-decoration` の部分対応）は、同じ種類の既存の項目と同じ理由で許可リストに 1 件追加 |
| 回帰 | `regress/`: 両 Electron で全検査（各 3,871 件、FAIL 0。PASS 2,430、PASS (EMULATED) 805、DIFF 606、UNSUPPORTED 30）と陰性テスト（各 693 件すべて宣言どおり）。11B の 1 回目と比べて、共通の検査の状態の差 0。増えたのは新しい 12 件（3 件 × 2 テーマ × 不透明の 2 回）だけで、すべて PASS。測定値の差はランナーの記録（スタイルシートの長さ 135,000 → 136,151 文字、ウィンドウのフォーカスのクラス、ポインタの再試行の回数）だけ |
| 残る差 | Wiki リンクの内側の括弧（Inkdrop は `[Other note]` の括弧にも下線）。Obsidian の `[[`・`]]` は 1 つの span で、既存の B3 に含めた |

E43 の 1 回目の全検査は、ディスプレイが消灯から復帰した時刻（14:00:49 JST、`pmset` の記録）にページが 180 秒応答せず止まった（`regress/runtime-electron-43.7.7-stalled.txt`）。止まった実行は使わず（§6.30.5）、E43 の全検査だけをやり直した（`runtime-electron-43.7.7.json`）。

## 4. 残る差の一覧

既存の判断で生じている表示の差を、§6.30.3 の 4 つの種類に分けた。「出典」は判断を記録した節（14）とレビュー、「証跡」はその差を示す記録。**どの差も、リリースの合格に数えるかは決めていない**（DIFF・UNSUPPORTED のリリースでの扱いは RV7。11H）。

### 4.1 確定した判断どおりの差

| # | 差 | 範囲 | 出典 | Q-D | 証跡 |
|---|---|---|---|---|---|
| A1 | File Explorer の行の hover は Obsidian の既定の色（Inkdrop のサイドバーの行は hover で変わらず、ノートリストの未選択の行の hover は観測していない） | デスクトップ | §6.8 判断 2（工程 5） | Q-D1 | 本書 §1 の `hovered-row~hovered-row`（ΔE2000 SD 1.97、KD 6.82、DIFF (decided)）。Inkdrop 側の観測は V-33（11G、承認待ち） |
| A2 | 閲覧ビューのチェックボックスの見た目（Inkdrop は既定の灰色、Obsidian は工程 5 の割り当て） | Reading view | §6.8（工程 5）、§6.13（RV3） | — | `evidence/phase3-rv3/v30-compare/`、本書 `cdp-*/screenshots/*-5.png` |
| A3 | 字体・大きさ・太さ（Inkdrop のエディタは等幅、Obsidian は利用者のフォント設定。見出し・太字・脚注の大きさと太さは変えていない） | 全ビュー | Q-D8、§6.11 判断 3（RV3） | Q-D8 | `evidence/phase3-rv3/v30-compare/`、本書の画像 |
| A4 | KD の編集ビューのガターの右線を描かない（Inkdrop の KD は 1px の線） | 編集ビュー（KD） | §6.21（ユーザーの指示、2026-10-12） | Q-D23 | `evidence/phase3-step9/gutter-border-39.5.1/`、実行時の検査 `ed.*.gutter-border-none` |
| A5 | アクティブ行の強調が常に有効（Inkdrop の既定は無効。V-30 の状態 1〜3 にはない） | 編集ビュー | Q-D23（09 §0.1.2） | Q-D23 | 本書 `cdp-*/screenshots/*-4.png`（状態 4 で同じ色: `active-line~active-line` PASS）。状態 1〜3 はカーソルを撮影範囲の外に置いて撮った |
| A6 | タグの hover は通常の色のまま | デスクトップ | §6.8 判断 3（工程 5） | Q-D5 | 実行時の検査 `ui.tag.*` |
| A7 | 影と角の丸みは Inkdrop に合わせていない | オーバーレイ | §6.8 判断 8（工程 5） | — | V-33（11G、承認待ち）で形を比べる予定 |
| A8 | エディタのタスク完了の線の色（Inkdrop は文字色の 60%、パレットのトークンでない既定値） | 編集ビュー | §6.11（RV3） | — | §6.11「再現していないもの」 |
| A9 | モバイルのフローティングのナビゲーションバーは Obsidian 標準の半透明 | phone | 09 §0.1.1（2026-10-13、ユーザーの確定）、§6.23 | Q-D10 | `evidence/phase3-step10/device-run2/` |
| A10 | モバイルのクイックスイッチャーは iOS 版の表現（90% の透明度） | phone・tablet | 09 §0.1.1（2026-10-13）、§6.23 | Q-D10 | `leak.quick-switcher.opaque`、`evidence/phase3-step10/device-run2/` |
| A11 | 面の構造（Inkdrop のサイドバー｜ノートリスト｜エディタを、Ribbon｜左ドック｜エディタに対応させる） | デスクトップ | Q-D1（2026-10-11） | Q-D1 | 本書 §1 の面の組（すべて PASS） |

### 4.2 Obsidian の DOM・lint・アプリの制約で再現していないもの

| # | 差 | 範囲 | 出典 | Q-D | 証跡 |
|---|---|---|---|---|---|
| B1 | 表: 区切り行の色（app.css が行クラスで塗る。行クラスは公式 lint でセレクタに使えない）、見出し行の太さ、表全体の枠（最後の行を示すクラスがない） | Source mode | §6.11、§6.13（RV3） | — | `evidence/phase3-rv3/v30-compare/sd-editor-vs-source.png` ほか |
| B2 | コードフェンスの言語名の色（「```js」が 1 つの span） | Source mode | §6.13（RV3） | — | 同上 |
| B3 | Wiki リンクの括弧（Inkdrop は `[[` を知らず、外側の `[` が本文色、内側の `[` が記号色で、内側の `[…]` に下線。Obsidian は `[[`・`]]` が 1 つの span） | Source mode | §6.13（RV3）、§6.48（下線） | Q-D4 | 本書 `link-underline/` |
| B4 | 引用のバー（Obsidian は Live Preview でだけ描く） | Source mode | §6.11、§6.13（RV3） | — | `evidence/phase3-rv3/v30-compare/` |
| B5 | Callout の種類ごとの色とバー（1 行目に種類のクラスがない） | Source mode | §6.11（RV3） | — | §6.11 |
| B6 | Live Preview の画像の背景（Inkdrop は行幅の箱、Obsidian は画像自身） | Live Preview | §6.11（RV3） | — | §6.11 |
| B7 | コードブロックのメタ行（言語名・ファイル名）、`==text==` の記号（Inkdrop に記法がない） | 編集ビュー | §6.11（RV3） | — | §6.11 |
| B8 | 非アクティブのウィンドウの translucent（Obsidian だけ暗くなる。ウィンドウの素材の設定で、CSS では変えられない） | macOS・translucent | §6.6（V-38、記録のみ） | Q-D22 | `evidence/phase3-v38/measurements/v38-compare-gray-inactive.csv` |
| B9 | Inkdrop だけの UI（プレビューのメタデータの欄、ノートリストの抜粋）と Obsidian だけの UI（プロパティ、ノートの題名の行、ステータスバーの項目） | 全体 | §6.11（E31、プロパティは比べる相手がない） | — | 本書の画像 |

### 4.3 構文の DIFF

| # | 差 | 件数 | 出典 | Q-D | 証跡 |
|---|---|---|---|---|---|
| C1 | トークナイザの粒度で Inkdrop の色に揃えられないトークン（`qd13.fidelity`） | 各 Electron 606 件（11B と同じ） | §6.17・§6.19（RV5） | Q-D13 | `evidence/phase3-step8/differences.csv`・`fidelity.csv`、`evidence/phase3-step11/11b/runtime-*.json`、本書 `regress/` |

### 4.4 Mermaid の UNSUPPORTED

| # | 差 | 件数 | 出典 | Q-D | 証跡 |
|---|---|---|---|---|---|
| D1 | Flowchart・Sequence 以外の 7 図種（class・state・gantt・pie・ER・git graph・mindmap）は Obsidian の反転フィルタのまま（`qd12.unsupported`） | 各 Electron 30 件（11B と同じ） | §6.21（工程 9、`37bb5b5` で承認） | Q-D12 | `evidence/phase3-step9/runtime/`、`evidence/phase3-step11/11b/runtime-*.json`、本書 `regress/` |

### 4.5 比べる相手がないもの（差ではなく、比較の範囲外）

V-30 のノートにない要素（Callout、ハイライト、kbd、脚注、画像、埋め込み、水平線）は Inkdrop の画面との比較がない（§6.13）。色の値は一次資料と Computed Style で検証済み。Inkdrop の撮影が要るため、11G の V-39・V-33 と同じく承認が要る。

## 5. ファイル

| ファイル | 内容 |
|---|---|
| `cdp-e43/`・`cdp-e39/` | Obsidian の CDP の撮影（各 12 枚）と、撮影ごとの記録（`measurements/*.json`） |
| `v30-compare-e43.*`・`v30-compare-e39.*` | `tests/visual/v30-compare.py` の結果（CSV と出力） |
| `v30-compare-swapped-themes-control.txt` | 陰性対照（テーマを入れ替えた比較、42 組 FAIL） |
| `v38-reuse/` | V-38 の生成物（`52434a5`）と現在の生成物の、translucent の描画の層 |
| `link-underline/` | リンクの下線の修正: 前後の画像、除去実験、全 span の差 |
| `regress/` | 修正後の回帰: 両 Electron の全検査と陰性テスト、止まった E43 の 1 回目の出力 |
| `visual-self-test.txt` | 視覚比較の道具の陰性テスト（15 件） |
