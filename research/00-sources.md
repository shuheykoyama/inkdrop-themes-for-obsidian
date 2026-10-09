# 00. 出典一覧

- 調査日: 2026-10-09（JST）
- 取得方法: GitHub リポジトリは `git clone --depth 1`（HEAD の 1 コミットのみ）で、作業リポジトリ外の一時領域に取得した。読み取り専用で扱い、変更・push はしていない。浅いクローンのため、ファイル単位のコミット履歴は原則として取得していない。履歴が必要な箇所だけ GitHub API（`gh api`）で個別に確認した。
- 出典の表記: 本資料群では `repo@SHA7 path:line` の形式を使う。`SHA7` は下表の SHA の先頭 7 桁である。
- 区分
  - **一次情報**: 公式ドキュメント、公式ソースコード、アプリ同梱の CSS / JS
  - **第三者**: 公式以外のテーマ実装、Web 上の解説
  - **参考の上流**: 移植対象テーマが色の出典として挙げている上流プロジェクト

---

## 1. Inkdrop（一次情報）

| リポジトリ | SHA | HEAD の日時 | 用途 | 主な参照先 |
|---|---|---|---|---|
| [inkdropapp/css](https://github.com/inkdropapp/css) | `add48d97db7ccf4a7f9c90db88721d80b36ccd92` | 2026-10-07 | 基盤 CSS（`@inkdropapp/css` v0.9.14） | 01, 02 |
| [inkdropapp/solarized-dark](https://github.com/inkdropapp/solarized-dark) | `4337f6e5ea9871b6193b5a3bf8db6206de2c3678` | 2026-09-30 | **移植対象 1**（v2.2.1） | 02 |
| [inkdropapp/kanagawa](https://github.com/inkdropapp/kanagawa)（`packages/dragon`） | `f9c14a57392c64b85527860eae9eb58c1b03ba32` | 2026-09-30 | **移植対象 2**（kanagawa-dragon v1.2.1）。比較用に `packages/wave`, `packages/lotus` | 02 |
| [inkdropapp/api-docs](https://github.com/inkdropapp/api-docs) | `965790b10dd73ea7f1a7aa72e715583ce2346a0d` | 2026-09-23 | developers.inkdrop.app の原稿（`src/app/guides/create-a-theme/page.mdx` ほか） | 01, 02 |
| [inkdropapp/default-dark](https://github.com/inkdropapp/default-dark) | `68c28c4670be754e22de3dee56676498f9b1c125` | 2026-09-15 | 標準テーマ（比較） | 01, 02 |
| [inkdropapp/default-light](https://github.com/inkdropapp/default-light) | `ef81d483615d994dd6291b5070ce47bc4040a49b` | 2026-09-15 | 標準テーマ（比較） | 01, 02 |
| [inkdropapp/theme-dev-helpers](https://github.com/inkdropapp/theme-dev-helpers) | `a7bcbe60747e33b12404b0f183de3fd1e8f10050` | 2026-09-30 | `palette.json` 生成器、dev server | 01, 02 |
| [inkdropapp/base-ui-theme](https://github.com/inkdropapp/base-ui-theme) | `6846d3f21bd59ddbc8afaa9077c2b0d8eb68da8b` | 2026-09-14 | Semantic UI ベースのコンポーネント CSS | 01 |
| [inkdropapp/mermaid](https://github.com/inkdropapp/mermaid) | `384e9f5e99a67b3ad9861695ebda63f4406da2c7` | 2026-09-11 | Mermaid プラグイン（`theme.ts`, `render.ts`） | 01 |
| [inkdropapp/gfm-alerts](https://github.com/inkdropapp/gfm-alerts) | `0562b55aa6713578b62536ad9156d300ab51da20` | 2026-07-22 | GFM alert プラグイン | 01 |
| [inkdropapp/solarized-light](https://github.com/inkdropapp/solarized-light) | `0f6bbb952cd93ef7cabfe71e6ad2236f6e6cfd23` | 2026-09-30 | 比較 | 02 |
| [inkdropapp/nord-light](https://github.com/inkdropapp/nord-light) | `96af6654b1ef26f29bbe53df61cb960d8b08e5df` | 2026-09-30 | 比較 | 02 |
| [inkdropapp/gruvbox](https://github.com/inkdropapp/gruvbox) | `3ca0060f23acadd64c5e393ff1df40c76a37e10d` | 2026-09-30 | 比較 | 02 |
| [inkdropapp/solarized-dark-syntax](https://github.com/inkdropapp/solarized-dark-syntax) | `39f67ee2d854815b59bc76c81f5cce2f029bcffa` | 2026-06-24 | v5 形式の旧 syntax テーマ（比較） | 02 |
| [inkdropapp/kanagawa-dragon-syntax](https://github.com/inkdropapp/kanagawa-dragon-syntax) | `0ef752c683a785227461c3dab4da32147d18f3ec` | 2026-06-26 | v5 形式の旧 syntax テーマ（比較） | 02, 07 |
| [inkdropapp/inkdrop-ui-theme-template](https://github.com/inkdropapp/inkdrop-ui-theme-template) | `011080bef03533239189d5985516a43686071544` | 2024-10-25 | v5 形式のテンプレート（旧形式の確認） | 01 |
| [inkdropapp/version-history](https://github.com/inkdropapp/version-history) | `072811f8e7cd8b158233492afa019a0b8ebf7240` | 2026-08-04 | リリースノート（v5.11.10 まで。v6 の記載なし） | 01 |
| [inkdropapp/docs](https://github.com/inkdropapp/docs) | `96cacac42f77f5f7677d0ef846fc52567f199ea9` | 2026-10-08 | ユーザーマニュアル。`src/app/reference/migrate-from-v5-to-v6/page.md:80-85` に「v6 はテーマを単一パッケージに統合し、v5 用テーマは読み込まれない」とある。`extend-with-plugins/page.md:63-71` にテーマ切替と「OS の外観に合わせて既定の light / dark を自動切替」の設定がある。テーマ作成の詳細は api-docs 側 | 01 の補強 |

GitHub API で追加確認した履歴:

- `inkdropapp/kanagawa` の `styles/palette.css` は初回コミット `7cd5fba`（2026-06-24）の時点で dragonBlack2 = `#181616`、dragonBlack3 = `#1D1C19 (ui.bg)` だった（`gh api repos/inkdropapp/kanagawa/contents/styles/palette.css?ref=7cd5fba`）。monorepo 化（`0b7f9e1`、2026-08-28）で `packages/dragon/styles/palette.css` へ移動した。
- `inkdropapp/solarized-dark` と `inkdropapp/kanagawa` の GitHub API の `license` は null（LICENSE ファイルなし）。

Web ページ（一次情報）:

| URL | 取得日 | 内容 |
|---|---|---|
| https://developers.inkdrop.app/guides/create-a-theme | 2026-10-09 | 公開ページを WebFetch で取得し、api-docs 原稿と同じ記述（`theme` レイヤーの位置づけ、`package.json` の例）であることを確認した |
| https://forum.inkdrop.app/t/whats-new-in-v6/5570 | 2026-10-09 | v6 の変更点（01 で参照） |

---

## 2. Obsidian（一次情報）

### 2.1 アプリ本体

| 対象 | 版 | 取得元 | 識別子 | 用途 |
|---|---|---|---|---|
| `app.css` / `app.js` / `index.html` | **1.14.4**（最新安定版、主対象） | `https://github.com/obsidianmd/obsidian-releases/releases/download/v1.14.4/obsidian-1.14.4.asar.gz` を展開 | `app.css` SHA-256 `866e50ac84dd8ad2775e0047ebd3ec5bd03e5af722aff259e6c4ea3cec42d7ba`（22,559 行） | 03, 05 |
| 同上 | **1.13.7**（ユーザー環境の現行版） | `~/Library/Application Support/obsidian/obsidian-1.13.7.asar` を展開（読み取りのみ） | `app.css` SHA-256 `f612f1e8f36486fa57f3b8bd45f0c848409d5b168002e757a13c6d286a7b4c41` | 03（差分比較） |
| Obsidian.app（インストーラー） | 1.11.7 | `/Applications/Obsidian.app/Contents/Info.plist` | Electron 39.5.1、Chrome/142.0.7444.265（Electron Framework の Info.plist とバイナリ文字列） | 07 §12 |

- 最新安定版の根拠: `obsidian-releases@1eb9ae2 desktop-releases.json` の `latestVersion: "1.14.4"`（beta も 1.14.4）。
- 展開物は一時領域に置き、作業リポジトリには含めていない。Vault、Obsidian の設定、CSS スニペットには一切触れていない。

### 2.2 リポジトリ

| リポジトリ | SHA | HEAD の日時 | 用途 |
|---|---|---|---|
| [obsidianmd/obsidian-developer-docs](https://github.com/obsidianmd/obsidian-developer-docs) | `c56c7e770ba25dd0ea392aacf4588f9425970d36` | 2026-08-10 | docs.obsidian.md の原稿。**1.14.0（2026-09-02）より前**の時点 |
| [obsidianmd/obsidian-sample-theme](https://github.com/obsidianmd/obsidian-sample-theme) | `beff4151e60c2aa12088d4ccffbfb223394db0fd` | 2026-08-14 | 公式テンプレート |
| [obsidianmd/obsidian-releases](https://github.com/obsidianmd/obsidian-releases) | `1eb9ae2ef8af9c1865eaec744fa2c43617d5e2eb` | 2026-10-09 | `community-css-themes.json`（847 件）、`desktop-releases.json` |

### 2.3 Web ページ

| URL | 取得日 | 備考 |
|---|---|---|
| https://docs.obsidian.md/Themes/App%20themes/Build%20a%20theme | 2026-10-09 | 内容は原稿 `c56c7e7` で確認 |
| https://docs.obsidian.md/Themes/App%20themes/Theme%20guidelines | 2026-10-09 | 同上 |
| https://docs.obsidian.md/Reference/CSS%20variables/CSS%20variables | 2026-10-09 | 同上。公開版との全文差分は未確認（09 U-08） |
| https://docs.obsidian.md/Reference/CSS+variables/Window/Tooltip | 2026-10-09 | 「ページが存在しない」と表示された。1.14 で追加された `--tooltip-*` が公開版でも未掲載であることと整合する |
| https://obsidian.md/changelog/ | 2026-10-09 | 1.9〜1.14 のテーマ関連変更。**WebFetch の要約経由**で、原文全文とは照合していない（03 §8.3、09 U-07） |
| https://community.obsidian.md/assets/community-themes.json | — | `community-css-themes.json` のミラー元（obsidian-releases のワークフローから確認） |

---

## 3. 既存の Obsidian テーマ（第三者）

| リポジトリ | SHA | HEAD の日時 | 調査の深さ |
|---|---|---|---|
| [kepano/obsidian-minimal](https://github.com/kepano/obsidian-minimal) | `93321bdc23fc879966e1e3aa0cfeda77012f540f` | 2026-10-06 | 重点 |
| [catppuccin/obsidian](https://github.com/catppuccin/obsidian) | `95eac6d290622542306b2b19fd20d4700775a394` | 2026-10-05 | 重点 |
| [Akifyss/obsidian-border](https://github.com/Akifyss/obsidian-border) | `dd59bd54438597f61b38eb5b967919e979526c41` | 2026-10-06 | 特徴的な実装 |
| [colineckert/obsidian-things](https://github.com/colineckert/obsidian-things) | `9b8bef93d3919f7693ac78597beaa35bbbd4cfff` | 2026-06-07 | 特徴的な実装 |
| [AnubisNekhet/AnuPpuccin](https://github.com/AnubisNekhet/AnuPpuccin) | `82d207c646904e7af371ced499f682fbdfad1012` | 2024-12-01 | 特徴的な実装（約 22 か月更新なし） |
| [sspaeti/obsidian_kanagawa](https://github.com/sspaeti/obsidian_kanagawa) | `4594f5d39e70ffffe04d6982af2eb57057dbe485` | 2026-05-22 | 実装方法の参考のみ（**移植の正本ではない**） |
| [kmkkiii/obsidian-kanagawa-theme](https://github.com/kmkkiii/obsidian-kanagawa-theme) | `515d04d017d6a71ef256e5574710601da729ef9a` | 2026-03-30 | 実装方法の参考のみ（**移植の正本ではない**） |

---

## 4. 参考の上流パレット

| リポジトリ / URL | SHA | 用途 |
|---|---|---|
| [craftzdog/solarized-osaka.nvim](https://github.com/craftzdog/solarized-osaka.nvim) | `a21176efde15fab21fabda0bf2ba123ed6d7332d`（2026-08-24） | Inkdrop Solarized Dark のパレット元（README が明記）。Apache-2.0 |
| [rebelot/kanagawa.nvim](https://github.com/rebelot/kanagawa.nvim) | `bb85e4bfc8d89b0e62c8fa53ccdd13d12e2f77b3`（2026-05-10） | Inkdrop Kanagawa のパレット元。MIT。**正本は Inkdrop 版**で、上流とは区別する |
| [altercation/solarized](https://github.com/altercation/solarized) | GitHub API で license（MIT）のみ確認 | 本家 Solarized。MIT（Copyright (c) 2011 Ethan Schoonover） |
| https://ethanschoonover.com/solarized/ | 2026-10-09 取得 | 本家 Solarized 16 色の値（02 §11） |

---

## 5. ツール・その他（第三者）

| 対象 | 確認内容 | 取得日 |
|---|---|---|
| npm registry | `sass` 1.105.1（2026-09-29）、`postcss` 8.5.29（2026-10-05）、`postcss-import` 17.0.0（2026-08-14）、`lightningcss` 1.33.0（2026-07-20）、`stylelint` 17.16.0（2026-10-01）、`stylelint-config-obsidianmd` 0.1.0（2026-07-31） | 2026-10-09 |
| https://sass-lang.com/d/import, https://sass-lang.com/blog/import-is-deprecated/ | `@import` は Dart Sass 1.80.0 で非推奨、3.0.0 で削除予定（1.80.0 から 2 年以上後） | 2026-10-09 |
| WCAG 2.x | コントラスト比の計算式（相対輝度）。07 §14 の計算に使用 | — |

`postcss-nesting` は、レビュー時に npm registry で最新版 14.0.3（2026-10-05 公開、`engines.node` は `>=20.19.0`）を確認した。初版調査で記載した 14.0.0（2026-01-14）は 14 系の初版である。

Phase 1B（独立レビュー対応）で追加した一次情報:

| 対象 | 確認内容 | 取得日 |
|---|---|---|
| [HTML Standard](https://html.spec.whatwg.org/multipage/semantics.html)「update a style block」 | `<style>` から作られる CSS スタイルシートは location を持たない（08 §1） | 2026-10-09 |
| [CSS Values and Units 4](https://drafts.csswg.org/css-values-4/) §4.5.1 Relative URLs | 文書に埋め込まれたスタイルシートの相対 URL は、そのコンテナのベース URL で解決される（08 §1） | 2026-10-09 |
| [CSS Custom Properties for Cascading Variables 1](https://www.w3.org/TR/css-variables-1/) | カスタムプロパティの計算値は「変数を置換した指定値」で、`var()` は宣言された要素の上で解決されてから継承される（07 R05） | 2026-10-09 |
| [docs.obsidian.md Editor/Code](https://docs.obsidian.md/Reference/CSS%20variables/Editor/Code) | 公開版の文言が原稿 `Editor/Code.md:17-18` と同じ "may not match perfectly" であること（03 §6.3） | 2026-10-09 |
| Obsidian 1.14.4 の `lib/codemirror/modes.min.js`、`lib/prism.min.js` | 編集ビューは CM5 モード（`defineMode("…")` の呼び出し 119 個）、閲覧ビューは Prism（03 §6.3） | 2026-10-09 |
| `sass` 1.105.1、`lightningcss-cli` 1.33.0（`npx` で一時実行、リポジトリには追加していない） | 色の出力形式（08 §3.3・§3.5） | 2026-10-09 |

---

## 6. 生成データと再現手順

`research/data/` の機械可読データは、[`research/tools/`](tools/) のスクリプトで再生成できる。手順と各スクリプトの役割は [tools/README.md](tools/README.md) にある。

| ファイル | 内容 | 生成元（`research/tools/`） |
|---|---|---|
| `inkdrop-base-tokens.csv` | 基盤 CSS のトークン定義 2,372 件（レイヤー、条件、参照、消費箇所） | `analyze_tokens.py` |
| `inkdrop-solarized-dark-tokens.csv` | SD 適用時の全トークンの宣言値と解決値（2,356 件） | `resolve_tokens.py` |
| `inkdrop-kanagawa-dragon-tokens.csv` | KD 適用時の全トークンの宣言値と解決値（2,395 件） | 同上 |
| `inkdrop-palettes.json` | 両テーマのパレット、Osaka・本家 Solarized・kanagawa.nvim との対応 | `build_palettes.py` |
| `obsidian-css-variables-1.14.4.csv` | Obsidian の CSS 変数 1,235 件（ドキュメント掲載の有無、既定値、定義セレクタ、1.13.7 との差分） | `cssvars.py` + `apply_manual_notes.py`（手で確認した注記 15 件は `manual_notes.json`） |
| `obsidian-ui-inventory.csv` | Obsidian の UI 要素 108 件 | `mkcsv.py`（行の内容はスクリプト内に人手で記述） |
| `mapping-candidates.csv` | Inkdrop ↔ Obsidian 対応候補 97 件 | `gen_mapping.py`（行の内容は人手、値の列は機械抽出） |
| `inkdrop-contrast.csv` | 主要な文字色・背景色の組のコントラスト比 30 件 | `contrast.py` |

**再現性の検証結果（Phase 1B）**: `fetch_sources.sh` で 30 リポジトリを記録済みの SHA で取得し直し、Obsidian 1.14.4 / 1.13.7 の asar を GitHub Releases から取得し直した。`app.css` の SHA-256 は §2.1 の値と一致した。この入力から `regenerate.sh` で再生成したところ、Phase 1B での修正前の時点で、8 ファイルすべてがコミット済みのファイル（基準コミット `e35d5f5`）とバイト単位で一致した。ただし `obsidian-css-variables-1.14.4.csv` は、手書きの注記 15 件を `manual_notes.json` に切り出してからの一致である（Phase 1 では一時的なスニペットで追記していた）。

**再現できない、または部分的にしか再現できないもの**:

- `obsidian-ui-inventory.csv`、`mapping-candidates.csv` の行の内容（分類、根拠、確信度など）は人手の判断で、スクリプトはそれを CSV に書き出すだけである。判断の過程は再現の対象外。
- 05 の棚卸しで使った探索用の補助スクリプト（app.css を規則単位に分解する `parse.py` など）はリポジトリに含めていない。05 の本文の数値（変数 961 個、`body` の 876 個など）は、`cssvars.py` の出力で照合できる範囲に限って検証した（README「資料間で数値が異なる箇所」）。
- 02 の `leaks.py` は、基盤既定色に解決されるトークンを列挙する補助スクリプトで、出力ファイルは `research/data/` にない（02 §13.4 の件数の根拠）。
- 04 の `!important` / `:has()` の件数は `cssstats.py` の出力で、テーマのリポジトリを引数に渡して再計測できる。
- Web ページ（docs.obsidian.md、developers.inkdrop.app、changelog など）は取得時点の内容で、固定版は保存していない。

**値の解釈についての注意（Phase 1B で訂正）**: 02 の解決値は、両テーマの `palette.json` と 1,638 / 1,638 件一致した。ただし `palette.json` は theme-dev-helpers の harness 上の値で、`var()` の展開はブラウザ、`light-dark()` の分岐はツールの文字列処理による。両テーマには `color-mix()` 由来の値がないため、色は `hsl(45deg 7% 11%)` のような文字列のまま記録されている。この一致が示すのは本調査の解決結果と harness の結果の一致であり、実アプリ上の値や画面上の描画色ではない（02 §1.5、07 R14）。
