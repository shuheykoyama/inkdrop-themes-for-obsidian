# 角丸 3 規則の正式統合と iPhone キットの更新（2026-11-04）

[14](../../../14-implementation-plan.md) §6.188 の証拠。独立レビュー（工程 11W: APPROVE / COMPLETE、角丸 3 規則: ADOPT）のあと、`../11v-overlay-corner-trial/trial.patch` の 3 規則を `src/common/components/overlays.css` に統合した（コミット `736b4c7`）。

## 統合前の画像確認

`../11w-overlay-corner-gui/shots/` の 16 枚すべてを、4 枚ずつの合成（元の画素のまま、並べるだけ）で見た。パレット 4 枚（SD・KD × 最終・試験）、メニューの先頭・末尾の hover 8 枚、窓の端のメニュー 4 枚。角の欠け、項目の背景のはみ出し、文字の切れ、重なりはなかった。試験のパレットは外枠の角が丸くなり、選択行の角も丸い。メニューの先頭・末尾の hover は、角の弧の内側に収まっている。窓の端のメニューは、ステータスバーのメニュー（窓の右下の端）で、窓の内に収まっている。

## 差分

`overlays.css` に 18 行の追加だけ（3 規則と、理由のコメント）。試験の CSS から変えたのはコメントの 1 文だけ（「Obsidian のプロンプトの影も同じ」という書き方が `11v` の README と合わなかったので、「影は Obsidian のまま」に直した）。セレクタと値は同じ。コメントを除いた生成 CSS は、SD・KD とも、工程 11W の試験ビルド（`/UIT2`）と一致した。

## CSS の SHA-256（`dist/`、`npm run build`）

| テーマ | 前 | 後 |
|---|---|---|
| SD | `f6b59e61…` | `7e4936c68f2d8a9722d7108e8fcc97b418dcf0a57bf719bcfb02449cb1705734` |
| KD | `9cc55c6f…` | `2d5556d6c51c9fd835db1d4d0e4a2e794b600703ecb7e70127c8d9966dbe4020` |

## 検査

- `npm test`: 終了コード 0（静的検査 S1〜S5・stylelint を含む。g7 の自己テスト 84 件）。
- 生成 CSS の 3 規則は、すべて `:not(.is-mobile)` を持つ（SD・KD とも、`.prompt` と `.menu` の規則の数が 3）。
- G4・V-38・G8 の再撮影はしていない（3 規則と直接関係せず、GUI 確認は 11W で済み）。基準・オラクル・許容差は変えていない。

## iPhone キット

- 新しいキット: kit id `b2a24a48-cb52-49fd-9aed-fd1aaafb2f73`（`736b4c7` の新しいクローンで `tests/device/build-kit.mjs`）。ZIP の SHA-256 `79f592fcabb533e718288680d034a5b3b38670e3a92a5ff61ff701c9bc9c55dd`。ジョブ 80（probe 66、extra 32）、検査 480（電話 66 ジョブ、タブレット 28）、ツアーの手順 電話 38・タブレット 18。11P のキットと同じ構成。ファイルの SHA-256 は `kit-files.sha256`（18 ファイル。`theme.css` は上の表と同じ）。
- 旧キット `c60ce128-4211-4b20-a132-325c72efdb49`（`b3d1989`、SD `f6b59e61…`、KD `9cc55c6f…`）は証跡として保持（`../11p-canvas-graph-integration/kit/`）。ランナー・オラクル・期待値は変えていない。
- 自己テスト `build`（34 件）: PASS（`kit-self-test-build.txt`、Mac 上のみ）。`plugin`・`dry-run`・`dry-run-tablet` は、隔離 Obsidian の GUI を使うので、新しい許可があるまで実行していない。

## iPhone への影響の評価

- 設計: 3 規則とも `:not(.is-mobile)` で、モバイルには当たらない。ほかの規則・変数は変えていない。
- **これは設計と生成 CSS の文字列の確認で、モバイルの Computed Style が変わらないことの測定ではない**（モバイルのエミュレーションでの計測も、実機も未実施）。
- 期待値・検査の変更は不要と見る（角丸の期待値は spec にない）。実機での確認は、ユーザーの「準備できた」のあと。

## 確かめていないこと

- キットの `plugin`・`dry-run` の自己テスト、モバイルの Computed Style、iPhone の実機。
- パレットの末尾行、More options メニュー、設定画面・Canvas の未撮影 UI、Inkdrop との focus リング（いずれも 11W と同じ。PASS とは記録していない）。
