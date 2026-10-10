# research/tools — 調査データの再生成と検証

`research/data/` の機械可読データを、記録済みの入力ソースから再生成し、コミット済みのファイルと突き合わせるためのスクリプトである。**テーマのビルドツールではない。** Phase 1 では作業リポジトリ外の一時領域にあったものを、Phase 1B（独立レビュー対応）でここに収録した。

## 必要なもの

- `git`、`curl`、`gunzip`、`shasum`
- Python 3.12 以上（標準ライブラリのみ）
- Node.js と `npx`（Obsidian の asar 展開に `@electron/asar@4.3.1` を一時実行する。グローバルにはインストールしない）

## 手順

```sh
# 1. 入力ソースを取得する（work_dir は作業リポジトリの外に置く）
research/tools/fetch_sources.sh <work_dir>

# 2. 再生成して、コミット済みのデータと突き合わせる（research/data/ は上書きしない）
research/tools/regenerate.sh <work_dir> <out_dir>
```

`regenerate.sh` は次の 3 つを出力し、問題があれば終了ステータス 1 を返す。

1. `research/data/` の各ファイルとの比較（`MATCH` / `DIFF` / `MISSING`）
2. `06-mapping-candidates.md` の生成ブロックと、再生成した表の比較
3. `final_check.py` の結果（リンク、データの読み込み、ID の重複と未定義参照、06 の Markdown と CSV の一致）

`research/data/` を更新したいときは、`<out_dir>/data/` の該当ファイルを差分を確認してからコピーする。06 の表は次で差し替える。

```sh
python3 -I research/tools/splice_generated.py research/06-mapping-candidates.md <out_dir>/tmp/mapping-fragment.md
```

## 入力ソース

| 入力 | 取得元 | 固定の方法 |
|---|---|---|
| 30 リポジトリ | GitHub | [`sources.lock`](sources.lock) の SHA（`<dir> <sha> <clone url>`）。`fetch_sources.sh` は各 SHA だけを `--depth 1` で取得する |
| Inkdrop 6.1.5 の配布物（Phase 2B、静的解析だけに使う。起動・インストールはしない） | `https://dist.inkdrop.app/releases/inkdrop-6.1.5-arm64-mac.zip` | SHA-256 `96c9a1e6…`（`fetch_sources.sh` 内で `shasum -c` により照合） |
| Obsidian 1.14.4 / 1.13.7 の `app.css` ほか | `obsidianmd/obsidian-releases` の GitHub Releases にある `obsidian-<ver>.asar.gz` | `app.css` の SHA-256 を `research/00-sources.md` §2.1 に記録。`fetch_sources.sh` が最後に表示する値と照合する |

`fetch_sources.sh` は `<work_dir>/repo-shas.txt` も書き出す。`resolve_tokens.py` と `build_palettes.py` は、このファイルから出典表記用の SHA を読む。

## スクリプト一覧

| スクリプト | 出力 | 資料 | 備考 |
|---|---|---|---|
| `fetch_sources.sh` | `<work_dir>/repos/`、`<work_dir>/obsidian-app/` | 00 | |
| `regenerate.sh` | `<out_dir>/data/`、比較結果 | 00 §6 | |
| `analyze_tokens.py` | `inkdrop-base-tokens.csv` | 01 §9 | `@inkdropapp/css` の宣言を、レイヤー・条件・参照・公開ソースでの消費箇所付きで列挙 |
| `resolve_tokens.py` | `inkdrop-solarized-dark-tokens.csv`、`inkdrop-kanagawa-dragon-tokens.csv` | 02 §3 | カスケードレイヤーの順序に従って勝つ宣言を選び、`var()` を展開し、`light-dark()` は dark 側を選ぶ |
| `build_palettes.py` | `inkdrop-palettes.json` | 02 §2 | |
| `leaks.py` | 標準出力のみ | 02 §13.4 | 基盤既定色（Tailwind 系）に解決されるトークンを列挙する補助。出力ファイルはない。引数は `<トークン CSV> <任意の文字列>`（第 2 引数は使われない）。1 行目に件数を出す（SD 94、KD 8。`--tag-*` は除外して数えるため、KD のタグ色は含まない） |
| `cssvars.py` | `obsidian-css-variables-1.14.4.csv` | 03 §3.4 | app.css 1.14.4 / 1.13.7 と docs 原稿の突き合わせ |
| `apply_manual_notes.py` + `manual_notes.json` | 同上に注記を追記 | 03 §3.4・§11.2 | docs の綴り誤りや inline 注入など、手で確認した注記 15 件 |
| `mkcsv.py` | `obsidian-ui-inventory.csv` | 05 | **行の内容はスクリプト内に人手で記述**。スクリプトは CSV に書き出すだけ |
| `gen_mapping.py` | `mapping-candidates.csv`、06 の表の断片 | 06 | **行の内容（分類、根拠、確信度）は人手**。値の列、「Inkdrop 適用先」列、空欄の「SD / KD の差」列は機械的に埋める |
| `splice_generated.py` | 06 の生成ブロック | 06 | `--check` で一致を確認するだけにできる |
| `contrast.py` | `inkdrop-contrast.csv` | 07 §14 | WCAG 2.x の相対輝度の式。色は HSL 宣言を 8 ビット sRGB に換算した計算値 |
| `inkdrop_consumers.py` | `inkdrop-consumers-6.1.5.csv` | 11 §5・§6 | （Phase 2B）展開済みの Inkdrop の asar で、06 の非公開・混在行のトークンを `var()` で参照する宣言を列挙する。抜粋は 1 宣言・140 字まで |
| `cssstats.py` | 標準出力のみ | 04 §7 | テーマの `theme.css` の `!important` / `:has()` などを数える。引数にファイルを渡す |
| `xref.py` | 標準出力のみ | — | Phase 1 のレビューで使った相互参照チェック。現在は `final_check.py` が上位互換 |
| `final_check.py` | 標準出力のみ | — | §手順の 3 |

## 件数の定義

| 件数 | 定義 |
|---|---|
| `inkdrop-base-tokens.csv` 2,372 | `@inkdropapp/css` の 10 ファイル（tokens, utilities, ui, status, task-progress, tags, syntax, markdown, mermaid, reset）にある `--*` の宣言の数。同じ名前の条件付き再定義も 1 件と数える（ユニークな名前は 2,354） |
| `inkdrop-*-tokens.csv` 2,356 / 2,395 | テーマ適用時に `:root` で勝つ宣言を、トークン名ごとに 1 行にしたもの。テーマ固有の名前（KD の `--kanagawa-*` など）を含むため、テーマによって数が違う |
| `palette.json` との一致 1,638 | theme-dev-helpers が対象にする「セレクタがちょうど `:root` の宣言」の集合（01 §7）。値の比較は引用符の違いだけを正規化した |
| `obsidian-css-variables-1.14.4.csv` 1,235 | app.css 1.14.4 / 1.13.7 で定義された変数と、docs に載っている変数の和集合（pdf.js 由来 125 件を含む） |
| `obsidian-ui-inventory.csv` 108 | 05 で棚卸しした UI 要素の数（人手） |
| `mapping-candidates.csv` 97 | 06 の対応候補の数（人手） |

## 検証結果（Phase 1B、2026-10-09）

- `fetch_sources.sh` で取得した `app.css` の SHA-256 は、1.14.4 と 1.13.7 のどちらも `research/00-sources.md` §2.1 の値と一致した。
- `regenerate.sh` の再生成結果は、Phase 1B での修正前の時点で、8 ファイルすべてがコミット済みのファイル（基準コミット `e35d5f5`）とバイト単位で一致した。`obsidian-css-variables-1.14.4.csv` は、手書きの注記を `manual_notes.json` に切り出してからの一致である。
- Phase 1B の修正後（`mapping-candidates.csv` の列追加、`obsidian-ui-inventory.csv` の注記修正）も、修正後のスクリプトで再生成した結果がコミットするファイルと一致することを確認した（最終確認は Phase 1B のコミット前に実施。結果は `research/10-review-remediation.md` §6）。

## 再現できない部分

- 05・06 の行の内容は人手の判断であり、スクリプトはそれを書き出すだけである。
- 05 の探索に使った補助スクリプト（app.css を規則単位に分解するものなど）は収録していない。
- Web ページの内容は取得時点のもので、固定版は保存していない。
- Inkdrop・Obsidian の実機での computed style と描画色は、どのスクリプトも扱っていない。
