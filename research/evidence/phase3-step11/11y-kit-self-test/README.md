# iPhone キット `b2a24a48…` の自己テストと、モバイルでの角丸 3 規則の確認（2026-11-04）

[14](../../../14-implementation-plan.md) §6.189 の証拠。ユーザーの許可（隔離 Obsidian のみ。通常の Obsidian・Vault、本番 Inkdrop、iPhone 実機には触れない）のあと、既存の `tests/device/kit-self-test.mjs` を `plugin`・`dry-run`・`dry-run-tablet` で実行した。新しいテスト基盤は作っていない。キットは作り直していない（自己テストが `736b4c7` の `dist` から、それぞれ自分の作業フォルダにキットを作る）。仕様・期待値・基準は変えていない。

## 実行環境

- `OBSIDIAN_APP` = 1.14.5 の複製（`Info.plist` の `CFBundleShortVersionString` は 1.14.5）、`OBSIDIAN_ASAR=none`。起動したインスタンスの User-Agent は **Electron 43.8.3**。CDP は 127.0.0.1:9335（実行前に未使用を確認）。隔離 userData と Vault は、モードごとの作業フォルダの中（スクラッチ）。
- 同時に、ユーザーの通常の Obsidian（`/Applications/Obsidian.app`）が動いていたが、触れていない。
- CSS は `736b4c7` のビルド（SD `7e4936c6…`、KD `2d5556d6…`）。
- **ラベルの問題**: `kit-self-test.mjs` の判定レポートのラベルは「isolated Obsidian 1.14.4」の固定だった。実行時に、使うアプリの `Info.plist` の版と Electron の版から作るように直した（`tests/device/kit-self-test.mjs`）。ただし、この直しは、今回の実行のあとに入れた。**今回の保存済みレポートのラベルは「isolated Obsidian ?, Electron 43.8.3」**（版の読み取りに User-Agent を使い、Obsidian の版が入っていなかったため）。実際の版は上のとおり 1.14.5。直したコードは、構文と版の取得だけ確かめた（再実行はしていない）。

## 結果

| モード | 自己テストの件数 | 結果 |
|---|---|---|
| `plugin` | 63 | すべて PASS（正しいキットの受け入れ、別 Vault・マーカー欠落・不正・別 kit id の拒否、拒否時にファイルを変えない、ケーブル操作の代替コマンドの拒否） |
| `dry-run`（電話） | 7 | すべて PASS（`dry.emulated-phone`、`dry.accepted`、スクリーンショットツアー、ドロワーのヘッダ・ジオメトリ ほか） |
| `dry-run-tablet` | 10 | すべて PASS |

判定レポート（`report-dry-run*.json`、`judge-*.txt`）:

- 電話: PASS 754、DIFF 96、FAIL 52、UNSUPPORTED 10、N/A 4。
- タブレット: PASS 286、DIFF 96、FAIL 14、UNSUPPORTED 10。
- **FAIL はすべて `device.environment`**（電話 52、タブレット 14）。理由は、デスクトップの Obsidian での電話・タブレットのエミュレーションが、実機にはないクラス（`is-frameless`、`is-hidden-frameless`、`emulate-mobile`、`is-floating-nav` など）を持つこと。既知の環境由来で、実機の結果とは区別する。**それ以外の FAIL・例外・欠落はなかった。**
- N/A 4 件（電話）: `ui.toggle.on-user-accent`、`ui.font.user-override-first`（電話でない要素の検査）。DIFF（構文の色の忠実度）・UNSUPPORTED（Mermaid）は、これまでの記録と同じ種類で、今回の 3 規則とは無関係。
- **エミュレーションの結果は、iOS 実機の PASS の代わりにならない。**

## モバイルでの 3 規則（`mobile-corner-check.mjs`、`mobile-result.json`）

同じ隔離 Obsidian で、`emulateMobile(true)`（既定はタブレット。`body` に `emulate-mobile`、`is-tablet`、`is-mobile`）にして、角丸の 3 規則を**持たない CSS**（`[final]`）と**持つ CSS**（`[trial]`。コメントを除いた生成 CSS は、正式統合した CSS と同じ）の Computed Style を比べた（SD・KD）。コマンドパレットを実際に開いた値と、`.menu`・`.prompt`・`.suggestion-item` のクラスを持つ要素を `body` に作って測った値。

| 状態 | パレット外枠 | パレットの行 | `.menu` |
|---|---|---|---|
| デスクトップ・規則なし | 12px | 4px | 8px |
| デスクトップ・規則あり | 24px | 7px | 15px |
| モバイル（エミュレーション）・規則なし | 24px | 24px | 8px |
| モバイル（エミュレーション）・規則あり | 24px | 24px | 8px |

モバイルでは、規則の有無で変化なし（SD・KD とも）。モバイルのパレットの 24px は Obsidian 自身の値で、規則がなくても同じ。エミュレーションを解くと、デスクトップに戻った（`body` のモバイルのクラスなし）。

- **限界**: 測ったのはタブレットのエミュレーション（`is-mobile` を含む。`:not(.is-mobile)` はこれで判定される）。電話のエミュレーションでの同じ測定、iOS 実機の Computed Style、実際にモバイルで開く各種メニューは測っていない。

## 後片付け

- 隔離 Obsidian を停止、ポート 9333・9335 は閉。`kit-self-test` のプロセスなし。通常の Obsidian（実行中）に変更なし。
- LaunchServices: 作業前の `check` には、1.14.5 の複製のアプリが候補として並んでいた（前の作業の残り）。`restore` のあとは、`/Applications/Obsidian.app` だけになった（`ls-before.txt`・`ls-after.txt`、ホームのパスは伏せた）。つまり、作業前の状態にぴったり戻したのではなく、より元の状態に近い形になった。
- 私が起動した `caffeinate` は停止。
- 画像は撮っていない（ツアーの画像は各作業フォルダの中。コミットしていない）。

## 確かめていないこと

- iOS・iPadOS 実機（ユーザーの「準備できた」が必要）、電話エミュレーションでの 3 規則の測定。
- キットの再生成はしていない（自己テストの結果で、仕様・期待値を変えていない）。
