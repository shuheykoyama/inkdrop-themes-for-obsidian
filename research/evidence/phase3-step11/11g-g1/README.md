# 工程 11G G1: 新しいキットでの iPhone の実機の検証（2026-10-20）

[14](../../../14-implementation-plan.md) §6.65 の証拠。

- ユーザーの承認（§6.63.6 の 1〜6、今回の G1 に限る）のもとで行った。
- iPhone ではテスト用の Vault だけを扱った。普段の Vault・Sync・iCloud・ほかのアプリには触れていない。
- 端末の識別子は記録していない。トンネルは USB の iPhone に限るため、識別子をシェルの変数で渡しただけ。出力にもファイルにも残していない。中継のログは識別子を含みうるので、入れていない。
- ローカルのパスは `<scratch>` などに置き換えた。

## 環境

| 項目 | 値 |
|---|---|
| 端末 | iPhone 12 Pro（USB の接続の情報: iPhone13,3、iOS 27.0） |
| Obsidian | 1.14.5（`apiVersion`。ユーザーの申告では 1.14.5 (387)） |
| 画面 | 390×844 CSS px、倍率 3。セーフエリアは上 47px・下 34px |
| Mac | macOS 26.5.2、Node 22.22.0、pymobiledevice3 11.29.0（更新していない） |
| キット | `daac8e2`（clean）から作成。kit id `abfb7c19-790d-477f-ac54-7ca4184684b8`。phone は 66 ジョブ、ツアーは 38 段（`kit/`） |

## `kit/`

- `kit.txt`: 元のコミット、kit id、zip の SHA-256、ジョブの数。
- `inkdrop-device-kit.json`: キットの目印（kit id と、キットの各ファイルの SHA-256）。
- `kit-self-test.mjs build` は 34 件 PASS（新しい出力先での実行。1 回目は出力先が既にあったため止まった）。

## `old-vault/`（旧いテスト Vault の結果の控え）

- `old-vault-look.json`: 旧い Vault を、読むだけで照会した結果。
  - Vault 名は `InkdropThemeTest`。
  - プラグインは RV6 より前の版で、照合の機能がない。キットの目印もない。
  - `device-results` は 3 ファイル。
  - 目印がないので、`cable.mjs probe`・`pull` は設計どおり止まった。
- `old-pull.mjs`: 承認された代わりの方法 (a)。
  - Vault 名、旧いプラグイン、目印がないこと、3 ファイルの名前が記録と一致すること、を確かめる。
  - そのうえで、Web インスペクタ経由で中身を読むだけで写す。端末には書き込まない。
- `old-results.sha256.txt`: 3 ファイルとも JSON として読めた。
  - `results-…09-11-01…` と `tour-…09-21-51…` は、`phase3-step10/device-run2/` の写しと SHA-256 が一致した。
  - `results-…08-07-36…` は写しがない。そのため、ここに保存した（64 ジョブの結果。古いプラグインのまま動いた回と推定）。
- 控えたのは結果のファイルだけで、Vault 全体ではない。旧い Vault は、端末の上で `InkdropThemeTest-step10` に名前を変えて残した（ユーザーの操作）。

## `device/`（新しいキットの照合と検査）

- `probe-new.txt`・`probe-new2.txt`: `cable.mjs probe`。2 つ目は、ケーブルをつなぎ直したあとのもの。
- `new-look.json`: 目印の kit id が新しいキットのものと一致し、プラグインの照合が通り、プラグインが有効で、端末が `is-phone` であることを読んだもの。
- `results-2026-10-20T06-17-51-248Z.json`: Run checks の結果。`device` は phone で、66 ジョブ。結果のファイルには kit id は入らない作りなので、直前の照合で結び付けている。
- `report.json`・`judge.txt`: `judge.mjs` の判定。
  - 916 件で、PASS 801、**FAIL 0**、DIFF 101、UNSUPPORTED 10、N/A 4。`device.environment` は 52 件すべて PASS。
  - 工程 10 の 910 件とは、判定がすべて同じ。新しい 6 件（Source mode のリンクの下線）は PASS。

## `tour/`（スクリーンショットのツアー）

- 38 段のすべてを撮影した（`*.png`、1170×2532）。12 番と 31 番では、ユーザーがキーボードを出すためにタップした。
- すべての画像を目で確かめた。通知などの個人の情報は写っていない。
- PNG に埋め込まれた情報は、画像の大きさと色空間だけ。
- `shots.json`: 撮影の記録。ドロワーの段には、撮影の直前・直後の `geometryBefore`・`geometryAfter` がある。
- `tour-*.json`: プラグインのツアーの記録。ドロワーの段には、開始時と終了時の幾何情報とその時刻がある。
- `drawer-header.json`: `tests/device/drawer-header.py --tour` の結果。4 件とも PASS（dE2000 0.009〜0.014、領域の標準偏差は最大 0.2）。
- `timing.txt`: 参考の記録で、判定には使っていない。
  - 開始時・終了時は端末の時計、撮影は Mac の時計。
  - 撮影は、どちらの余裕も 3 秒以上ある位置にあった。
- `tour.log`: `cable.mjs tour` の出力。
- 途中で、Web インスペクタの接続が切れた。ツアーの前、ケーブルの接続が外れたとき。そのため、中継を起動し直し、probe で照合し直してから撮影した。
