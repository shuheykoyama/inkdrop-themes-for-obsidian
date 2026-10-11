# Q-D21 ビルド方式の比較 PoC

[`research/13-q-d21-build-poc.md`](../../13-q-d21-build-poc.md) の PoC。**完成版のテーマではない。** 出力（`dist/`）は配布用の `theme.css` ではなく、比較のための生成物で、コミットしない。

## 構成

| パス | 内容 | 使う方式 |
|---|---|---|
| `src/palette/<theme>.css` | テーマ別の値（Inkdrop の宣言をそのまま。出典の `file:line` 付き） | P1・P2 |
| `src/common/{mapping,components,translucent,mobile}.css` | 2 テーマ共通の構造 | P1・P2 |
| `src/themes/<theme>.css` | エントリ（`@import` の並び） | P1 |
| `p1-postcss/build.mjs` | P1: `postcss` + `postcss-import` だけ。色変換・圧縮なし | P1 |
| `p2-concat/build.sh` | P2: 同じファイルを同じ順に `cat` で連結（順序はスクリプト内に記述） | P2 |
| `p3-sass/scss/` | P3: Dart Sass（`@use`、map、`@each`、mixin、ネスト）。同じ仕様・同じ出力宣言 | P3 |
| `tests/test-static.mjs` | T1（値の忠実度、`research/data` との照合）・T2（決定性、`@import` 残り、パース、欠落時の非ゼロ終了、方式間の宣言の一致） | 全方式 |
| `tests/clean-room.sh` | T2: 一時ディレクトリで `npm ci` → ビルド → テスト → ローカルの出力とバイト比較 | 全方式 |
| `tests/obsidian-isolated.sh`、`tests/runtime.mjs`、`tests/runtime/probe-poc.js` | T3: 隔離した Obsidian 1.14.4 で Computed Style を確認 | 全方式 |
| `tests/t4/*.patch`、`tests/t4/run-t4.sh` | T4: 3 種類（4 パターン）の変更を適用・ビルド・比較・復元 | 全方式 |
| `results/` | 実行結果（`static-t1-t2.log`、`runtime-t3.json` / `.log`、`t4.md`） | — |

## 実行手順

```sh
cd research/poc/q-d21-build
npm ci                         # postcss 8.5.29、postcss-import 17.0.0、sass 1.105.1（package-lock.json で固定）
npm run build                  # dist/p1、dist/p2、dist/p3 に 2 テーマずつ
npm test                       # T1・T2（node tests/test-static.mjs）
bash tests/clean-room.sh       # T2: クリーン環境での再インストールと再現性（npm のネットワークが必要）
bash tests/t4/run-t4.sh        # T4: 変更容易性（終了時にソースを基準状態へ戻し、ハッシュで確認）

# T3（macOS、Obsidian 1.14.4 がインストール済みで、ユーザーの Obsidian とは別の隔離インスタンスを使う）
W="$(mktemp -d)"
V="$(bash tests/obsidian-isolated.sh start "$W" | tail -1)"
node tests/runtime.mjs "$V" "$W/runtime.json"
bash tests/obsidian-isolated.sh stop "$W"
```

必要環境: Node 22 以上（`postcss-import` 17 の要件）。P2 は bash が必要。T3 は macOS と Obsidian 1.14.4、`../../evidence/phase2-p0/tools/cdp.mjs` を使う。
