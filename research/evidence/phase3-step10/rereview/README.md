# 工程 10 の再レビュー（Electron 39.5.1 の不安定な FAIL）の証拠（2026-10-14）

[14](../../../14-implementation-plan.md) §6.25 の証拠。Obsidian はすべて隔離したインスタンス（専用の `--user-data-dir` とテスト Vault の複製、Obsidian 1.14.4）で実行した。ユーザーの Vault・設定は開いていない。Inkdrop は起動していない。

## 最終のコードの実行（`final/`）

| ファイル | 環境 | 結果 |
|---|---|---|
| `runtime-electron-39.5.1.json` | Electron 39.5.1（`/Applications/Obsidian.app`） | 3859 件、FAIL 0（PASS 2418、PASS (EMULATED) 805、DIFF 606、UNSUPPORTED 30） |
| `self-test-electron-39.5.1.json` | 同上（同じインスタンス） | 685 件すべて宣言どおり |
| `runtime-electron-43.7.7.json` | Electron 43.7.7（現行インストーラのコピー） | 3859 件、FAIL 0（同じ内訳） |
| `self-test-electron-43.7.7.json` | 同上 | 685 件すべて宣言どおり |
| `kit-dry-run-emulated.json` | 実機キット（最終のコードで作り直したもの）を Mac の隔離インスタンスのエミュレーション（phone）で試運転した判定 | 910 件。FAIL 52 件はすべて `device.environment`（実機ではないので FAIL が正しい）。ほかに FAIL なし。ツアーは 38 ステップ。**RV6 の注記**: この試運転では `ed-fold` の折り畳みが起きておらず（`folded: false`、フォーカスの再現なし）、`ed.fold.*` の 6 件が N/A になっていた。修正後の `judge.mjs` で判定し直すと `device.ed-prepared` の 2 件が FAIL になる（`../rv6/rejudge/`、§6.27） |

- ポインタの状態の再試行は 0 回、設定の書き直しは 0 回、設定の検索欄に残った文字は 0 件、`runner.focus` の FAIL は 0 件だった。自己テストでの再試行 4 回は、わざとリンク以外にポインタを置く `self-test-pointer-missed` のもの。
- テーマの検査（`runner.*` 以外の 3066 件）を §6.23 の実行と比べると、Electron 43.7.7 は状態・測定値ともすべて同じ。Electron 39.5.1 は、§6.23 の 1 回目で FAIL した `ui.popover.background`・`ui.tooltip.background` の 2 件が PASS になった以外は同じ。件数の増加（3581 → 3859）は `runner.*` の検査（515 → 793）による。

## 安定性の確認（`stability/`）

明暗の切り替え（`setScheme`）を直す前のコードで、Electron 39.5.1 を 3 回実行した結果（`runtime-electron-39.5.1-run1.json`〜`run3.json`）。3 回とも 3859 件で FAIL 0。テーマの検査は最終のコードと同じ。2 回目は、最初の実行が Mac のスリープ（蓋を閉じた）で途中で止まったため、やり直したもの。止まった実行は使っていない。明暗の切り替えの修正は、キットの試運転で見つかった問題によるもので（§6.25）、その後の最終のコードで上の `final/` を取り直した。

## 原因の再現実験（`experiments/`）

どれも隔離インスタンスに CDP（127.0.0.1:9333）でつないで実行する。`node experiments/<名前>.mjs [回数]`。

| スクリプト | 内容 | 結果 |
|---|---|---|
| `race.mjs` | 行番号の設定を `false` にして保存させた後、`true` にして 2.5 秒後に値を見る。`reloadConfig` が見るファイルの `mtime` と `configTs` を記録する | Electron 39.5.1: 40 回中 8 回、30 回中 5 回、20 回中 2 回で `false` に戻った。戻ったときは `appearance.json` の `mtime` が `configTs + 1 ms`。Electron 43.7.7: 40 回中 2 回（`race-electron-43.7.7.json`） |
| `race2.mjs` | 同じ操作で、設定のオブジェクトの値が変わった瞬間の呼び出し元を記録する | 30 回中 3 回。呼び出し元はすべて `reloadConfig` の同じ箇所（`app.js` の `a[s]=o[s]`） |
| `fold.mjs` | 折り畳みの準備（すべて開く → 見出しで折り畳む）を繰り返し、フォーカスを記録する。フォーカスは折り畳みの操作の約 4 秒**後**（`cursor` の行）に記録したもので、操作の時点の値ではない | 8 回のうち、`document.hasFocus()` が `false` の 4 回（0〜3 番）はすべて折り畳まれず、`true` の 4 回は 3 回（5〜7 番）折り畳まれ、1 回（4 番）折り畳まれなかった（`fold-focus-electron-39.5.1.txt`）。フォーカスと結果はよく対応するが、操作の時点のフォーカスではないので、これだけでは原因と断定できない |
| `focus.mjs` | popover・tooltip・折り畳み・設定画面を、CDP のフォーカスの再現あり・なしで比べる。折り畳みは操作の直前のフォーカスも記録する（`fold` の 2・3 番目の値） | popover・tooltip・設定画面は、フォーカスの有無にかかわらず出た。折り畳みは、フォーカスの再現ありなら、ウィンドウに macOS のフォーカスがなくても成功した（1 回）。再現なしの 6 回は、最初に `false` だった回も含めて操作の直前にはフォーカスがあり、すべて成功した。つまり、この制御実験では「フォーカスがないと失敗する」側は起きていない（`focus-emulation-electron-39.5.1.txt`） |
| `states.mjs` | 設定画面・折り畳み・popover・tooltip が出るまでの時間を 20 回ずつ測る（折り畳みはすべて開く前の旧手順） | 設定画面・popover・tooltip は 20 回とも出た（popover・tooltip は約 0.3 秒）。旧手順の折り畳みは、前の折り畳みが残るため成功と失敗が交互になった（`states-electron-39.5.1.json`） |
| `settings.mjs` | テーマと translucent を切り替えてから設定画面を開き、アクティブな項目の大きさを時間とともに測る | 16 回とも 0.7 秒までに 200 px の幅になった（`settings-electron-39.5.1.json`）。0×0 は再現しなかった（原因は検索欄への入力。§6.25） |

最初の `race.mjs` の Electron 39.5.1 の結果は、画面への出力だけで、ファイルには保存していない（数値は上の表と §6.25）。

折り畳みとフォーカスの関係の根拠の強さ（§6.25 の表）: Obsidian のコマンドの定義（`hasFocus()` が真のときだけ折り畳む）と、フォーカスの再現で成功したことが直接の根拠。`fold.mjs` の対応は、操作の後のフォーカスによる間接の根拠。§6.23 で FAIL した回のフォーカスは記録がなく、その回の原因は推定。（2026-10-15、RV6 で「false 5 回、true 3 回」の誤りを直した。§6.27）
