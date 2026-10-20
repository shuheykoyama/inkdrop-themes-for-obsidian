# G1 の結果の来歴（事後に作った対応表、2026-10-21）

**この表は、G1 の実施のあとに作ったもの。** G1 の結果の JSON 自体には kit id が入っていない（キットのプラグインの作り）。実測のファイルの中身は書き換えていない。署名もし直していない。

この表は、既存の証跡から、実行の結果とキットの対応を記録するもの。11H でリリースの判定の入力を更新するときの参照の資料にする。

## ソースとキット

| 項目 | 値 | 出典 |
|---|---|---|
| ソースのコミット | `daac8e2`（作業ツリーは clean。`daac8e2..781458f` では `tests/`・`src/` に変更なし） | 14 §6.65.2 |
| kit id | `abfb7c19-790d-477f-ac54-7ca4184684b8` | `kit/inkdrop-device-kit.json`・`kit/kit.txt` |
| キットの zip の SHA-256 | `28d2a419049b0e7749083536dffb35f842e8af21c84d5d350951cf2307deecde` | AirDrop で送ったファイル（リポジトリには入れていない）。作ったとき、送る直前、この表を作るとき、の 3 回、同じ値 |
| キットの目印の SHA-256 | `a7eedfb2585da2fe44c6ba06b051cdaf773ca80d9cdb52e55c3ef44364d51c43` | `kit/inkdrop-device-kit.json` |

## 実機での目印の照合（検査の直前）

| 証跡 | SHA-256 | 内容 |
|---|---|---|
| `device/probe-new.txt` | `49ea112c…4ac` | `cable.mjs probe` が、Vault 名と目印の照合を通った（照合できなければ止まる作り） |
| `device/new-look.json` | `37a54d68…451` | 端末の目印の kit id が `abfb7c19-…84b8`。プラグインの照合の結果は null（通過）。プラグインは有効、`is-phone`、`device-results` は空 |
| `device/probe-new2.txt` | `1c68651a…8c5` | ケーブルのつなぎ直しのあとの、同じ照合（ツアーの直前） |

## 実機の結果と判定

| ファイル | SHA-256 | 原本と同一 |
|---|---|---|
| `device/results-2026-10-20T06-17-51-248Z.json`（Run checks の結果） | `f42f2ada406c0b9fc7b07225f06c03f0799aeb7217161509442b49f1209ad484` | はい |
| `device/report.json`（`judge.mjs` の判定） | `647d2308f23fc0805fd50a841b1991f338b660a310590ec8c366782b0b23309f` | はい |
| `tour/tour-2026-10-20T08-19-09-315Z.json`（プラグインのツアーの記録） | `3c51f40922838c0a267edefcbae98585ac8d3983c5e90945494629ea1f9237ff` | はい |
| `tour/shots.json`（`cable.mjs` の撮影の記録） | `b39796fa424dbe40f0674d662bd095ee3417ddf1f99a49f10ce975ed3e303ae7` | はい |
| `tour/drawer-header.json`（ドロワーのヘッダーの判定） | `a4010535df9c37c4327bc392c1e21d1a389b860470f5bfe35554d7d9eb57f3f9` | はい |
| `old-vault/results-2026-10-13T08-07-36-497Z.json`（旧い Vault の控え） | `7377fa6e1b13076fdf06f17be717e8e7a1d0380e5e53f3c8baf455b483e02587` | はい |

「原本と同一」の意味: 端末から写したとき、または道具が書き出したときのファイル（作業用の一時フォルダ）と、リポジトリの証跡がバイト単位で同じであること（2026-10-21 に確かめた）。

## 判定に使ったコード（`daac8e2` の時点の、各ファイルの最終変更）

| ファイル | コミット |
|---|---|
| `tests/device/build-kit.mjs`（キットとプラグイン） | `665f70d` |
| `tests/device/cable.mjs`（照合・検査・ツアー） | `665f70d` |
| `tests/device/drawer-geometry.js`（幾何情報） | `3247aca` |
| `tests/device/drawer-header.py`（ドロワーのヘッダーの判定） | `665f70d` |
| `tests/visual/sample-regions.py`（統計と CIEDE2000） | `3c78a90` |
| `tests/device/judge.mjs`（実機の結果の判定） | `2af9964` |
| `tests/runtime/probe.js`（測定） | `8dbce01` |
| `tests/spec/runtime/mobile.json`（モバイルの検査） | `f604475` |

## 結び付けの根拠と限界

結果の JSON とキットの結び付けは、次の 4 つによる。

1. 検査の直前の照合（目印の kit id が新しいキットのもの）。
2. その Vault に旧いキットがないこと（旧い Vault は、名前を変えて別のフォルダにした）。
3. 結果の内容が新しいキットのものであること。
   - `device` の項目は phone（11F で足した項目）。
   - 66 ジョブ。
   - Mermaid の flowchart が 3 図（11F で足した SVG ラベルのブロック）。
4. ツアーの記録に、`665f70d` で足した開始時・終了時の幾何情報があること。

結果のファイルそのものに kit id を記録させる変更は、行っていない。必要なら、次のキットのための課題として扱う。
