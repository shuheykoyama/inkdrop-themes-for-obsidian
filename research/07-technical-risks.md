# 07. 技術課題とリスク評価

- 調査日: 2026-10-09
- 対象: Inkdrop v6 テーマ（`@inkdropapp/css@add48d9`、`solarized-dark@4337f6e`、`kanagawa@f9c14a5`）→ Obsidian 1.14.4（主対象）/ 1.13.7（ユーザー環境）
- 位置づけ: 01〜06 の所見から、移植で問題になる点を課題ごとに整理し、**実装の選択肢**を並べる。どれを採るかは Phase 2 で決める。
- 凡例
  - 影響領域: **F** = 忠実度、**C** = 互換性（Obsidian の更新、プラグイン、OS）、**M** = 保守性、**A** = アクセシビリティ、**P** = 性能、**L** = ライセンス・帰属
  - 重大度: 高 / 中 / 低。発生可能性と影響の大きさから付けた主観評価であり、計測値ではない。
  - 根拠の確度は元資料の表記（確認済み / 推測 / 未確認）に従う。

---

## 0. リスク一覧（要約）

| ID | 課題 | 影響 | 重大度 | 根拠 |
|---|---|---|---|---|
| R01 | CSS 変数だけでは表現できない見た目がある | F, M | 高 | 05 直接セレクタ表 |
| R02 | シンタックスハイライトの粒度と意味が両アプリで一致しない | F | 高 | 02 §8.3, 03 §6.3 |
| R03 | エディタとプレビューで Inkdrop の配色が分かれている | F | 中 | 02 §5・§7.2, 06 §3 |
| R04 | Mermaid の配色経路が Obsidian にない | F, M | 中 | 01 §4.4, 05 Editor |
| R05 | 画面構成の違い（3 ペイン vs サイドドック）。3 ペイン構造は再現できず、3 段以上の背景色は docs 未掲載のクラスへの依存と引き換えになる | F, M | 高 | 02 §4, 06 §2 |
| R06 | 詳細度とクラスの再定義でテーマ変数が負ける | C, F | 高 | 03 §2.4, 05 全体の構造 |
| R07 | ユーザー設定（アクセント色、フォント）が inline style でテーマに勝つ | F | 中 | 03 §2.5 |
| R08 | ドキュメント未掲載の変数への依存 | C, M | 中 | 03 §3.4, 05 全体の構造 |
| R09 | Obsidian の頻繁な変数追加・変更（1.13 の OKLCH 移行、1.14 の 84 変数追加） | C, M | 中 | 03 §8 |
| R10 | OS・ウィンドウ設定による差（macOS、translucent、frame） | F, C | 中 | 03 §5, 05 Workspace |
| R11 | モバイルのダークモードで base 色が上書きされる | C | 中 | 03 §2.4 |
| R12 | Inkdrop 側の消費箇所が非公開で、宣言値の適用先が確定しない | F | 高 | 01 §4.1・§10 |
| R13 | Inkdrop テーマが基盤既定色（Tailwind 系）を継承している箇所（意図は不明）と、コメントの不整合 | F | 中 | 02 §13.4 |
| R14 | Kanagawa のパレット命名ずれと HSL 丸め | F | 中 | 02 §2.2・§12, 04 §6.3 |
| R15 | Inkdrop 原色のままではコントラスト基準を満たさない組み合わせがある | A, F | 中 | `data/inkdrop-contrast.csv` |
| R16 | コミュニティプラグインとの衝突・未対応 | C | 中 | 04 §1〜§6 |
| R17 | `!important` / `:has()` の必要箇所とガイドラインの衝突 | C, P | 中 | 03 §10, 05 直接セレクタ表 |
| R18 | 2 テーマ間の共通化が忠実度を損なう | F, M | 中 | 02 §13.3 |
| R19 | ライセンス・帰属・命名 | L | 中 | §11 |
| R20 | 実行環境の Chromium バージョン差 | C | 低 | §12 |
| R21 | ドキュメント記載どおりに書いても効かない変数がある | C, M | 低 | 03 §11.2 |

---

## 1. CSS 変数で表現できないスタイル（R01）

**事実（確認済み、05）**

- 変数がなく直接セレクタが必要な箇所は、05 の棚卸しで 108 要素中 12（selector）、一部にセレクタを要するものが 34（both）であった。
- 主なもの: アクティブ行（`.cm-line.cm-active`）、行番号ガター（`.cm-gutters` に `!important`）、左右サイドバーの塗り分け、Mermaid、シンタックスの細分化、エディタ内検索の一致、フォーカス表示、Markdown 記号、タブの曲線、Canvas ノードの既定色、Graph の強調色、ドロップダウン矢印、折り畳みプレースホルダ。
- Inkdrop 側にあって Obsidian 側に変数がない表現: 選択範囲のフォーカス有無、リストマーカーの階層別色、インラインコードの枠線、モーダルのヘッダー帯、h1/h2 の下線、mark の下線（06 §5）。

**選択肢**

| 案 | 内容 | 忠実度 | 保守性 |
|---|---|---|---|
| A. 変数のみ | 公式変数で表現できる範囲に留める | 低（上記がすべて Obsidian 既定のまま） | 高 |
| B. 変数 + 限定的な直接セレクタ | 再現価値の高い箇所だけ、低詳細度のセレクタで補完する | 中〜高 | 中 |
| C. 要素の局所変数を再代入 | `.cm-line.cm-active { background: var(--x) }` のように、セレクタは最小にして値は変数経由にする | B と同等 | B より高（値の変更がパレット側で完結） |

04 §8 推奨パターン 4（Catppuccin、Minimal）は C 型である。

---

## 2. CodeMirror の構文トークンの差（R02）

**事実**

- Inkdrop: Lezer の `.tok-*` クラスと `--syntax-*` 変数。エディタとプレビューのコードブロックは同じ変数を共有する（01 §4.2、02 §8）。
- Obsidian: `--code-*` 10 色＋`--code-normal` / `--code-background`。Reading View は Prism の `.token.*`、編集時は CM5 モード由来の `.cm-*` で、**同じ変数が両ビューで別のトークンを指す**（03 §6.3）。例: `--code-function` は Reading で `.token.function`、編集時は `.cm-property`。
- 公式ドキュメントの文言は「styling may not match perfectly between the two」で、不可能とは書いていない（`Editor/Code.md:17-18`、03 §6.3）。

**影響（Phase 1B で訂正）**

- Phase 1 は「完全一致は不可能」と断定し、その理由に「変数が 10 色しかない」「同じ変数が両ビューで別のトークンを指す」を挙げていた。これは**公式変数だけで写す場合**の制約であり、`.cm-*` / `.token.*` を直接塗れば回避できる。理由としては誤りだった。
- 一方で、直接セレクタを併用しても**原理的に区別できないトークン**がある。Obsidian 側のトークナイザが同じクラスを出すと、CSS では塗り分けられない。静的解析で次の例を確認した（03 §6.3）。
  - 編集時・JS: 関数呼び出しと変数参照がどちらも `cm-variable`。
  - 編集時・JS: メソッド呼び出しとプロパティ参照がどちらも `cm-property`。
  - 閲覧時・JS: `this` と `const` がどちらも `token keyword`。
  - 閲覧時・Python: 関数呼び出しに span が付かない。
- したがって、正しい結論は「公式変数のみでは再現不可。直接セレクタ併用で再現できる範囲は言語ごとのトークン粒度に依存し、一部は原理的に区別できない。全体の一致度は未検証」である。
- SD はトークンの色分けが細かい（string yellow、operator violet、class orange、punctuation cyan、variable base00 など）。KD は kanagawa.nvim の `syn` 表に沿っている。どちらも 10 色に縮約すると情報が落ちる。

**選択肢**

| 案 | 内容 | 忠実度 | 保守性 |
|---|---|---|---|
| A. `--code-*` のみ | 10 色に縮約 | 低〜中 | 高 |
| B. `--code-*` + `.token.*` / `.cm-*` の上書き | 両ビューのトークンクラスを直接塗り、意味を揃える。`.cm-def` / `.cm-atom` など既定で無色のクラスも塗れる | 中〜高（言語依存） | 中（Prism・CM5 モードのクラス名は Obsidian の実装に依存） |
| C. B の上で言語別の調整 | 特定言語のトークンを個別に合わせる | 高（ただしクラスの粒度による上限あり） | 低 |

残る検証: Obsidian の Prism / CM5 モードのトークンクラスが言語ごとにどの粒度で出るか、上の例が実機の DOM でも成り立つか（09 V-12）。

---

## 3. Markdown 編集・閲覧表示の差（R03）

**事実**

- Inkdrop はエディタ（`--md-*`、`--syntax-*`）とプレビュー（`--mde-preview-*`）が別系統の変数で、値もテーマによって違う（01 §4.3、02 §5・§7.2）。
  - KD のリンク: preview `#89997a`（dragonGreen2）、editor `#8ca5b1`（dragonBlue2）。preview.css:6 のコメントは「links dragonBlue2」で、実値と食い違う（02 §13.4）。
  - KD の本文: editor `#c5c9c5`、preview は同色の 90%。
  - SD の引用線: editor base01、preview base02。
- Obsidian の Live Preview と Reading View は、多くの変数（`--link-color`、`--text-normal`、`--hN-color`、`--blockquote-border-color`）を共有する（03 §6.1・§6.2）。
- Live Preview でクラスの垂直 margin を変えないことが self-critique checklist に書かれている（03 §6.1）。Inkdrop プレビューの見出し余白（上 24px / 下 16px、02 §10）を Live Preview に写すとこれに抵触する。

**選択肢**

| 案 | 内容 | 忠実度 | 保守性 |
|---|---|---|---|
| A. 1 つに寄せる | 編集・閲覧とも Inkdrop のプレビュー値（または エディタ値）に統一 | 中 | 高 |
| B. ビュー別に塗り分け | `.markdown-source-view` / `.markdown-rendered` で変数を再代入 | 高 | 中 |
| C. 要素別に判断 | リンクはプレビュー値、引用線はエディタ値、など | 中〜高 | 低（規則が恣意的になる） |

---

## 4. Mermaid のスタイリング（R04）

**事実**

- Inkdrop: `mermaid.css` の 150 変数を、プラグインが描画時に probe 要素で computed 値へ解決し、Mermaid の `themeVariables` として渡す。色は SVG に焼き込まれる（01 §4.4）。
- Obsidian: dark テーマでは SVG 全体に `filter: invert(100%) hue-rotate(180deg) saturate(1.25)` を掛けて反転させる（app.css L11875）。`mermaid.initialize` に渡すのは `fontFamily` だけで、配色を受け取る経路はない（05 Editor、app.js）。

**影響**

- 反転フィルタを解除しないと、テーマの色がすべて反転・色相回転される。
- 解除した上で SVG 内部要素（ノード、エッジ、ラベル、クラスタ、シーケンス図のアクター等）を CSS で塗る必要がある。Mermaid が要素にインラインの `style` や `fill` 属性を書く場合、CSS で上書きするには `!important` が必要になる可能性がある（推測。04 §9 も推測扱い。V-10 で確認）。
- 図種（flowchart、sequence、gantt、class、state、pie、git など）ごとにクラス名が違い、Mermaid のバージョン更新で変わりうる。

**選択肢**

| 案 | 内容 | 忠実度 | 保守性 |
|---|---|---|---|
| A. 何もしない | Obsidian 既定の反転表示 | 低 | 高 |
| B. フィルタ解除 + 主要図種の要素を塗る | flowchart / sequence 程度に限定 | 中 | 中 |
| C. 全図種を網羅 | Inkdrop の `--mermaid-*` に沿って全図種を塗る | 高 | 低（Mermaid の DOM 変更に脆い） |

未確認: Obsidian 1.14.4 が同梱する Mermaid のバージョンと、各図種の DOM（09 V-10）。

---

## 5. UI 階層の違い（R05）

**事実（02 §4、06 §2・§3）**

- Inkdrop は「サイドバー / ノートリスト / エディタ」の 3 面で明度の段階を作る。SD はサイドバーが最も明るく、KD はエディタが最も明るい。
- Obsidian は「Ribbon / 左サイドドック / ワークスペース / 右サイドドック / ステータスバー」で、ペイン本体の背景は `--background-primary`（ノート領域）と `--background-secondary`（左右ドック共通、`.workspace-tabs .workspace-leaf`、L6912-6913）の 2 つが基本。
- Ribbon（`--ribbon-background`）、タブヘッダー帯と分割の地（`--tab-container-background`）、タイトルバー（`--titlebar-background`）、ステータスバー（`--status-bar-background`）は docs 掲載の変数で個別に塗れる。ドックのタブ帯は docs 未掲載の `--sidebar-tab-container-background`（L6931-6932）。
- Obsidian の `--background-primary` はノート領域、Modal、Prompt、Popover、補完ポップアップが共有する（05 注意点）。
- app.js はサイドドックに `mod-sidedock` と、論理名（`mod-primary-split` / `mod-secondary-split`）・物理名（`mod-left-split` / `mod-right-split`）の両方を付ける。各ビューには `.workspace-leaf-content[data-type="file-explorer"]` などの属性が付く（Phase 1B で確認、静的解析）。

**影響（Phase 1B で訂正）**

- Phase 1 は「Inkdrop の 3 段（＋ page）を 2 段に縮約することになる」と断定していた。これは**公式変数だけでペイン本体を塗る場合**に限った話で、テーマで表現できる背景色の段数が 2 段に限られるわけではない。次の 2 つを区別する。
  - **構造的な 3 ペインの再現**: 不可能。File Explorer は 1 本のツリーで、Inkdrop の横並び（サイドバー｜ノートリスト）はテーマ CSS では作れない。
  - **3 段以上の背景色の再現**: 可能。手段と制約は次表のとおり。

| 手段 | 例 | docs 掲載 | 対応版 | 主な制約・副作用 |
|---|---|---|---|---|
| 公式の帯変数 | Ribbon、タブ帯、タイトルバー、ステータスバーを別色にする | 掲載 | 1.13.7 / 1.14.4 | `--tab-container-background` は左右ドックとルートのタブ帯で共有。**各分割の最上段のタブグループ（`.workspace-tabs.mod-top`）では、`--tab-container-background` と `--sidebar-tab-container-background` が `--titlebar-background` に置き換わる**（app.css L4354-4358。`mod-top` は app.js が最上段のタブグループに付ける）。通常、ドックのタブ帯は最上段にしかないため、タブ帯の色はタイトルバーの色と連動する |
| ドックのタブ帯とリストを別色にする | `--sidebar-tab-container-background` と `--background-secondary` | 未掲載 | **1.14 以降のみ**（1.13.7 の app.css に該当変数なし） | 上記のとおり最上段では `--titlebar-background` が勝つため、実際にはタイトルバー色との連動になる見込み。変数名の変更リスク |
| ドック本体を左右で塗り分ける | `.workspace-split.mod-left-split { --background-secondary: X }`（両版）または `.mod-primary-split`（**1.14 以降のみ**） | 未掲載（クラス） | `mod-left-split` は 1.13.7 / 1.14.4、`mod-primary-split` は 1.14.4 のみ（1.13.7 の app.js は `"mod-".concat(i,"-split")` で left / right だけを付ける） | 局所再定義は、その要素とその子孫で `var(--background-secondary)` を参照する箇所にだけ効く。`--tab-container-background` などは `body` 要素の上で計算値が確定し、子孫はその計算値を継承するため変わらない（CSS Custom Properties 仕様）。ドック内で secondary を直接参照する他の UI（graph-controls、分割要素上で宣言される Bases の表ヘッダー変数 L16191-16192 など）も同じ色になる |
| ビュー単位で塗り分ける | `.workspace-leaf-content[data-type="file-explorer"]` | 未掲載 | 1.13.7 / 1.14.4 | 同じドック内でも Search や Bookmarks のタブは別色になる |
| File Explorer 内の帯 | `.nav-header` と `.nav-files-container` | 未掲載 | 1.13.7 / 1.14.4 | DOM の親子関係は実機未確認 |

- 対応版は、各版の app.css / app.js に該当するクラス・変数があるかを grep で確認した結果である（Phase 1B の批判的レビューで判明）。1.14 以降のみの手段を使うかどうかは、09 Q-D20（`minAppVersion`）の判断に依存する。
- 共通の注意:
  - RTL では left / right が反転する。「Inkdrop のサイドバー側」という意味で塗るには、1.14 以降なら論理名の `mod-primary-split` が使える。1.13.x も対象にするなら `mod-left-split` を使い、RTL での反転を許容することになる。
  - モバイルのサイドバーは `.workspace-drawer` で、`--mobile-sidebar-background` を使う。デスクトップ用の `.mod-*-split` セレクタは届かない。
  - translucent 設定では、leaf・split・タブ帯が `transparent !important` で上書きされる（L6579-6590）。
  - Theme guidelines（L29-33）は、クラス名の変更でセレクタが壊れることを最も多い保守上の問題として挙げている。docs にはワークスペースのクラス名が載っていない。
- SD の popup（base04）や KD の popup（Black2）はエディタ面と色が違うため、`--background-primary` を共有する Obsidian の popover ではセレクタでの再代入が要る（06 G10）。

**選択肢**: 09 Q-D1 に整理した。公式変数だけで済ませる案と、上表の手段で段数を増やす案がある。どの面にどの色を当てるかで印象が大きく変わる（06 W03）。実機での確認項目は 09 V-03。

**Phase 2B の実機検証（VERIFIED、Obsidian 1.14.4、2026-10-10）**: 上表の手段は、デスクトップでいずれも実測で成立した。予測していた制約（局所再定義が `body` で計算済みの変数に伝わらない、最上段のタブ帯がタイトルバーの変数に連動する）も実測どおりだった。加えて、既定の Hidden frame では `.titlebar` 自体が表示されないこと、モバイル（エミュレーション）のドロワーは `--mobile-sidebar-background` で塗られ、`--background-secondary` の局所再定義では変わらないことが分かった。詳細は [11](11-runtime-validation.md) §7・§8。

---

## 6. 詳細度とクラスの再定義（R06）

**事実（03 §2.4、05 全体の構造）**

- app.css は変数の大半を `body`（0,0,1）で定義し、`.theme-dark`（0,1,0）で 61 変数を定義する（うち body の既定値を上書きするもの 11）。テーマが `body` で書くと `.theme-dark` 側に負ける変数がある（`--interactive-normal`、`--text-selection`、`--background-modifier-form-field` など）。
- `.mod-macos`（0,1,0）も `--interactive-normal` / `--interactive-hover` / `--input-shadow` / `--scrollbar-thumb-bg` / `--toggle-*` / 角丸系など 29 変数を定義する（うち body の既定値を上書きするもの 26）。読み込み順はテーマが app.css より後なので、同じ詳細度ならテーマが勝つ（03 §2.3、確認済み）。
- Canvas の既定ノード色は `body.theme-dark`（0,1,1）で定義されている（05 Obsidian 固有、L18187）。テーマが `.theme-dark` で上書きしても負ける。

**影響**: 色は `.theme-dark` で定義するのが原則だが、それでも負ける箇所がある。実機で computed style を確認しないと、効いていない変数に気付けない。

**選択肢**: (A) `.theme-dark` で定義し、負ける箇所だけ `body.theme-dark` 等で詳細度を上げる。(B) すべて `body.theme-dark` で定義する（ガイドラインの「低詳細度」と緊張関係）。どちらも実機検証が前提（09 V-01）。

---

## 7. ユーザー設定による上書き（R07）

**事実（03 §2.5、app.js 1.14.4）**

- アクセント色を設定すると `--accent-h/s/l` と `--text-on-accent` が `body` の inline style で注入され、テーマより優先される。
- フォント設定は `--font-*-override` として注入される。テーマ側は `--font-*-theme` を使う設計。
- `--font-text-size` は常に inline で設定される。Theme guidelines の例 `body{--font-text-size:18px}` は効かない可能性が高い（推測、未検証）。

**影響**: Inkdrop の primary color（SD blue-500 @90%、KD dragonBlue2）を `--accent-*` で表すと、ユーザーがアクセント色を変えた瞬間に崩れる。逆に `--accent-*` を経由せず固定値で塗ると、ユーザーのアクセント設定が効かなくなる（09 Q-D6）。

---

## 8. Obsidian 固有要素の配色（R08・R09）

**事実**

- Canvas、Graph、Bases、Properties、Callout の大半、Slides などは Inkdrop に対応元がない（06 の Obsidian-native 16 行）。
- これらの既定値の多くは `--color-*`（拡張色）と `--color-base-*` から派生する（04 §8 推奨 3、03 §3.2）。
- Bases は 79 変数のうち 33 が未掲載、カンバン 15 変数はすべて未掲載（05 Obsidian 固有）。1.14 で 84 変数が追加され、16 変数の既定値が変わった（03 §8.2）。

**影響**: 対応元がないため「忠実度」の基準がない。パレットからの導出規則を決めないと、要素ごとに場当たり的な配色になる。未掲載変数に依存すると、次のバージョンで名前が変わるリスクがある。

**選択肢**: (A) `--color-base-*` と `--color-*` を Inkdrop パレットで埋め、残りは Obsidian の派生に任せる。(B) 主要な固有要素（Canvas、Graph、Callout）だけ明示的に割り当てる。(C) 全要素を明示的に割り当てる。

---

## 9. OS 依存スタイル（R10・R11）

**事実**

- macOS: `.mod-macos` の変数上書き、信号機ボタン領域（`--traffic-lights-offset-x/y`、app.js が読む）、`.is-translucent` による透過（03 §5、05 Workspace）。
- Inkdrop 側: `:root:has(body.acrylic-window)` で半透明化、`.platform-win32` の dark 用上書き（01 §3.6、02 §1.4）。
- モバイル: `.is-mobile.theme-dark`（0,2,0）が `--color-base-00/10/20` を `#000 / #111 / #1e1e1e` に上書きする。テーマの `.theme-dark` は負ける（03 §2.4）。

**影響**: macOS を最優先にする方針（確定済み）なら、`.mod-macos` と translucent の検証が必須。モバイルを対象外にするなら、モバイルで Obsidian 既定の黒背景が出ることを許容することになる（09 Q-D10）。

---

## 10. プラグイン互換性（R16）

**事実（04）**

- 既存テーマは、Style Settings、Kanban、Dataview、Excalidraw などに個別対応している（Minimal 11 プラグイン、AnuPpuccin 約 11、Catppuccin 約 8）。
- コミュニティプラグインの多くは Obsidian の公式変数を参照する。公式変数を Inkdrop パレットで埋めておけば、プラグインにもある程度配色が届く（04 §8 推奨 1・3。推測）。
- 独自変数名だけで色を定義するテーマは、プラグインに配色が届かない（04 §8 アンチパターン 2、sspaeti 版 Kanagawa）。

**分類案（Phase 2 で確定）**

| 区分 | 方針 |
|---|---|
| コアプラグイン | 主要対応範囲（確定済み方針） |
| 公式変数を使うコミュニティプラグイン | 公式変数の割り当てで間接的に対応。個別のセレクタは書かない |
| 独自 DOM・独自色を持つコミュニティプラグイン | 対象外、または利用頻度の高いものだけ個別対応 |
| Style Settings | 対応するかどうかはユーザー判断（09 Q-D17） |

未調査: ユーザーが実際に使っているコミュニティプラグインの一覧（Vault には触れない方針のため未取得）。

---

## 11. ライセンス・著作権表示・帰属（R19）

**確認済みの事実**

| 対象 | ライセンス | 根拠 |
|---|---|---|
| inkdropapp/solarized-dark | `package.json` で MIT。**LICENSE ファイルはなく、GitHub API の license も null** | `solarized-dark@4337f6e package.json`、`gh api repos/inkdropapp/solarized-dark` |
| inkdropapp/kanagawa（dragon） | `package.json` と README で MIT。**LICENSE ファイルなし** | `kanagawa@f9c14a5 packages/dragon/package.json`、`README.md:45-47` |
| @inkdropapp/css | MIT（Copyright (c) 2024 Takuya Matsuyama） | `css@add48d9 LICENSE` |
| inkdropapp/default-dark | MIT（Copyright (c) 2016 Inkdrop） | `default-dark@68c28c4 LICENSE` |
| Solarized（本家） | MIT（Copyright (c) 2011 Ethan Schoonover） | `gh api repos/altercation/solarized`（2026-10-09 取得） |
| Solarized Osaka（Inkdrop SD のパレット元） | Apache-2.0 | `craftzdog_solarized-osaka.nvim@a21176e LICENSE` |
| kanagawa.nvim（Inkdrop KD のパレット元） | MIT（Copyright (c) 2021 Tommaso Laurenzi） | `rebelot_kanagawa.nvim@bb85e4b LICENSE` |
| obsidian-sample-theme | 0BSD 相当の許諾文（Copyright (C) 2020-2026 Dynalist Inc.） | `obsidian-sample-theme@beff415 LICENSE` |
| 参考テーマ | Minimal / Catppuccin / Border / Things / 既存 Kanagawa 2 種は MIT、AnuPpuccin は GPL-3.0 | 04 §7 |

**課題**

- Inkdrop テーマの CSS 構造や値を移植する場合、MIT の著作権表示の保持が必要になる。SD と KD のリポジトリには LICENSE ファイルがないため、**著作権表示の文言（年・権利者）をどこから取るか**が確定しない。`package.json` の `author` はどちらも Takuya Matsuyama である（`solarized-dark@4337f6e package.json:22`、`kanagawa@f9c14a5 packages/dragon/package.json:29`）。
- パレットの上流（Osaka は Apache-2.0、kanagawa.nvim は MIT）への帰属表示をどこまで書くか。色の値そのものに著作権が及ぶかは法的判断であり、本調査では判断しない。
- AnuPpuccin（GPL-3.0）のコードは流用しない方がよい。流用すると GPL が伝播する（04 §5）。
- テーマ名: Community directory はテーマ名に "Theme" と "Obsidian" を含めることを禁じ、投稿後は改名できない（03 §0）。登録済みの "Kanagawa" 系 5 件と重複しない名前が必要（04 §9）。"Inkdrop" や "Solarized" を名前に含めることが商標・慣行上問題ないかは未確認。

これらはユーザーの判断事項として 09 Q-D18・Q-D19 に転記した。法的な助言ではない。

---

## 12. 保守性と実行環境（R08, R09, R20, R21）

**事実**

- Obsidian のバージョン差
  - 1.13: 色の合成を OKLCH の `color-mix()` に移行。`*-rgb` / `*-hsl` 系は互換のためだけに残る。`--callout-color` は色値を受け取る形に変わった（破壊的変更）。
  - 1.14: `--text-highlight-bg` の既定定義を削除、84 変数を追加、16 変数の既定値を変更（`--icon-m` 18→16px、`--tab-curve` 6→10px など）（03 §8）。
- ドキュメント原稿 `c56c7e7`（2026-08-10）は 1.14.0（2026-09-02）より古く、1.14 の新変数は未掲載（03 §11.1）。
- ドキュメントどおりに書いても効かない変数: `--input-focus-border-color` / `--input-hover-border-color`（pdf.js の注釈レイヤーでのみ定義）、綴り誤りの `--nav-heading-color-colapsed-hover`、`--bases-table-text-size` など（03 §11.2）。
- Chromium のバージョン: ユーザー環境の Obsidian.app（インストーラー 1.11.7）に同梱の Electron は **39.5.1（Chrome/142.0.7444.265）** だった（`/Applications/Obsidian.app/Contents/Frameworks/Electron Framework.framework` の Info.plist とバイナリ文字列で確認）。asar 更新では Electron は更新されないため、同じ Obsidian 1.14.4 でも利用者のインストーラー次第で Chromium が異なる。03 §未確認事項 9 は「1.13.6 のインストーラーが Electron 43.3.0」（第三者）としている。
  - Inkdrop 側の squircle（`@supports (corner-shape: squircle)`）は Chromium 139 以上で有効とされる（03 §未確認事項 9）。Chromium 142 では条件を満たす計算になるが、実機での確認はしていない。

**影響**: 未掲載変数と CSS 新機能（`corner-shape`、`light-dark()` 等）への依存は、古いインストーラーの利用者で効かない可能性がある。Obsidian の更新ごとに変数一覧の差分確認が必要になる。

**選択肢**: (A) 依存する変数と機能を一覧化し、Obsidian 更新時に `data/obsidian-css-variables-*.csv` 相当の差分で確認する。(B) 未掲載変数には `var(--x, fallback)` でフォールバックを付ける。(C) `minAppVersion` を 1.14.0 以上にして古い版を切る。

---

## 13. Inkdrop テーマ自体の問題（R12, R13, R14）

**事実（02 §12・§13.4）**

- **非公開の消費箇所（R12）**: サイドバー、ノートリスト、エディタ外枠、ヘッダーメニュー、環境設定、通知、CodeMirror chrome の約 60 変数と `--editor-*` 63 変数は、公開ソースで使われていない。どの DOM に塗られるかは Inkdrop 本体の非公開 CSS 次第（01 §4.1・§9）。
- **基盤既定色（Tailwind 系）の継承（R13）**: テーマが上書きしなかったトークンが、基盤 `@inkdropapp/css` の既定ランプ（Tailwind 系の色）に解決される箇所。Phase 1 では「漏れ」と呼んでいたが、意図的な継承か見落としかはソースから判断できないため、Phase 1B で中立的な表現に改めた。**Inkdrop で実際に表示されるのはこの色**であり、「Inkdrop を正本とする」方針の下では、これも正本の一部である。
  - SD: 94 トークンが Tailwind 系に解決される（info → sky、warning 背景 → amber、secondary → zinc、`--focused-form-border-color` → sky-300、GFM important → `#a855f7` など）。
  - KD: タグ色の全体、コードブロック枠（Tailwind blue-200 @10%）、input error placeholder（red-200）。
  - 意図の手がかり: 同系の Inkdrop テーマ gruvbox は「対応のない系統は重複で埋めず、参照するセマンティック変数を付け替える」と明記している（02 §13.1）。SD と KD にはそうした注記がなく、意図は不明（09 U-11）。
- **コメント不整合（R13）**: KD `preview.css:6`（links dragonBlue2 と書いて実値は dragonGreen2）、`syntax.css:53` の "pmenu.bg"、`syntax.css:27` の "ui.bg_p2"。
- **Kanagawa の命名ずれ（R14）**: Inkdrop の `dragonBlack2` = `#181616`、`dragonBlack3` = `#1D1C19` で、kanagawa.nvim と逆（nvim は Black2 = `#1D1C19`、Black3 = `#181616`、`ui.bg = dragonBlack3`）。Inkdrop は初回コミット `7cd5fba`（2026-06-24）からこの並びで、旧 `kanagawa-dragon-syntax` も `--editor-background-color: hsl(var(--kanagawa-dragonBlack3)) /* ui.bg */`（`kanagawa-dragon-syntax@0ef752c styles/index.css:16`）。つまり **Inkdrop のエディタ背景は一貫して `#1D1C19` 系**であり、上流の `ui.bg`（`#181616`）とは違う。意図的かどうかは確認できない。
- **HSL 宣言と HEX コメントの差（R14）**: KD の CSS の宣言値は整数 % の HSL（例: dragonBlack3 = `hsl(45deg 7% 11%)`）で、行末コメントの HEX（`#1D1C19`）は参照用である。HSL を sRGB に変換して 8 ビットに丸めると `#1e1d1a` になり、コメントの HEX と最大 2/255 ずれる（Python の `colorsys` による計算）。
  - Phase 1B の訂正: `#1e1d1a` は**計算値**であって、画面上の描画色を測ったものではない。実際の描画色は Chromium の色変換とディスプレイの色管理を経る。Inkdrop の `palette.json` も値を `hsl(45deg 7% 11%)` のまま記録しており（カスタムプロパティの計算値は色に解決されない）、描画色の証拠にはならない。
  - 忠実度の観点で厳密なのは、Obsidian 側でも**同じ `hsl()` 宣言を書く**ことである。そうすれば両アプリとも同じ Chromium の変換を通るため、HEX への換算そのものが不要になる（ただし両アプリの Chromium 版と色管理が同じかは未確認）。

**影響**: 「Inkdrop を正本とする」方針の下で、基盤既定色の継承やコメントの不整合まで表示どおりに写すか、Inkdrop の意図を推定して直すかの判断が要る（09 Q-D9）。HSL 宣言の扱いは方針から導出できる（09 Q-D2）。

---

## 14. コントラスト（R15）

[`tools/contrast.py`](tools/contrast.py) で、主要な文字色と背景色の組の WCAG 2.x コントラスト比を宣言値から計算した（アルファは背景に合成してから測定。色は 07 R14 と同じく HSL 宣言を 8 ビットの sRGB に換算した計算値）。結果は [`data/inkdrop-contrast.csv`](data/inkdrop-contrast.csv)。実機の computed 値ではない。

| 組み合わせ | SD | KD |
|---|---|---|
| 本文 / エディタ | 5.31（AA） | 10.06（AA） |
| コメント / エディタ | 3.12（AA-large のみ） | 3.94（AA-large のみ） |
| ガター文字 / エディタ | 3.12（AA-large のみ） | **2.63（不合格）** |
| サイドバー項目 / サイドバー | 4.16（AA-large のみ） | 6.89（AA） |
| サイドバー節見出し / サイドバー | **2.42（不合格）** | 4.33（AA-large のみ） |
| 日付 / ノートリスト | 3.40（AA-large のみ） | 5.85（AA） |
| light テキスト / エディタ | 11.46（AA） | 3.86（AA-large のみ） |
| primary ボタン文字 / primary | 4.05（AA-large のみ） | 6.37（AA） |

- disabled テキストは両テーマとも不合格（SD 2.51、KD 2.08）だが、WCAG 1.4.3 は無効な UI 部品を対象外としている。
- コメントやガター文字が低コントラストなのは Solarized / Kanagawa の設計上の特徴でもある。Obsidian の公式ドキュメントにコントラスト要件はない（03 §10）。
- **忠実度とアクセシビリティが衝突する。** Inkdrop の値をそのまま写すか、基準を満たすよう調整するかはユーザーの判断事項（09 Q-D15）。

---

## 15. `!important` と `:has()`（R17）

- 公式ガイドラインは `!important` の回避を求め、self-critique checklist と stylelint 設定は `:has()` を Canvas の性能問題を理由に避けるよう求めている（03 §7・§10）。
- 一方で、`.cm-gutters` の `color` / `border-right` は app.css 側が `!important`（L3726）で、上書きにも `!important` が必要になる可能性がある。Mermaid の SVG インラインスタイルも同様の可能性がある（推測、04 §9）。
- 既存テーマの使用数（コメント除去後の theme.css を計測）: Border 176 / 60、AnuPpuccin 56 / 81、Minimal 49 / 32、Catppuccin 32 / 0、Kanagawa 2 種は 0 / 0（04 §7）。

**選択肢**: (A) 使用ゼロを原則とし、必要箇所は再現を諦める。(B) 使用箇所を限定して一覧で管理する。Inkdrop の acrylic 条件（`:root:has(body.acrylic-window)`）に相当する分岐は、Obsidian では `.is-translucent` クラスで書けるため `:has()` は不要である（03 §5）。

---

## 16. テーマ間で共通化できる部分（R18）

**共通化してよいと考えられるもの（根拠: 両テーマで同じ基盤値を使う、または同じ Obsidian 構造に依存する）**

- Obsidian 公式変数への割り当て構造（どの Inkdrop トークンをどの Obsidian 変数に入れるか）。04 §8 推奨 1 の「マッピング層」。
- 直接セレクタが必要な箇所のセレクタ自体（アクティブ行、ガター、Mermaid 要素、トークンクラスなど）。値は各テーマのパレットから入れる。
- 基盤由来の値（角丸、影、余白、フォント、スクロールバー、メニュー hover の白アルファ）。02 §10 で両テーマとも未変更と確認済み。ただし影は例外で、KD は `--black` の再定義により subtle-shadow の色が変わり、grouped-segment の影も再定義している（02 §10、06 G24）。

**共通化すると忠実度を損なうもの**

- 背景の奥行きの割り当て（SD と KD で逆、06 §3）。
- 状態色の作り方（SD はアルファ段階、KD は 2 色＋アルファ規則）。
- エディタとプレビューの値の分かれ方（KD のリンク、本文アルファ）。
- シンタックスのトークン割り当て（02 §8.3）。

共通化の単位を「値」ではなく「構造（どの変数を埋めるか）」に限れば、忠実度を損なわずに済む見込みが高い（推測）。

---

## 未確認事項

1. 各リスクの実際の発生有無（すべて静的解析による。実機の computed style、描画結果は未確認）。
2. Obsidian 同梱の Mermaid のバージョンと図種別 DOM。
3. Obsidian の Prism / CM トークンクラスの言語別粒度。
4. `.mod-left-split` / `.mod-right-split` の実機 DOM 上での付与（app.js の静的解析では確認済み）。macOS で `styled-scrollbars` が付かないことによるスクロールバー変数の無効化（静的解析では確認済み）。
5. Inkdrop の非公開 CSS におけるトークンの適用先。
6. テーマ名に第三者の製品名（Inkdrop、Solarized、Kanagawa）を含めることの可否。
7. Community directory の自動レビューのテーマ固有チェック項目の全体（03 §未確認事項 6）。
