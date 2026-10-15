# 工程 10 の RV6 の追加修正（実機キットの安全対策）の証拠（2026-10-15）

[14](../../../14-implementation-plan.md) §6.27 の証拠。iPhone・iPad・Android は操作していない。Obsidian はすべて隔離したインスタンス（専用の `--user-data-dir`、Obsidian 1.14.4、Electron 39.5.1、CDP は 127.0.0.1:9335）で、Vault はキットの複製だけを開いた。ユーザーの Vault・設定・Inkdrop には触れていない。`cable.mjs` は隔離インスタンスに向け、`pymobiledevice3` は呼ばれたことを記録するだけの代役に置き換えた（端末には接続しない）。

テストは `tests/device/kit-self-test.mjs`。作業フォルダは毎回新しく作り、何も削除しない。

| フォルダ | コマンド | 結果 |
|---|---|---|
| `build/` | `kit-self-test.mjs build` | 34 件すべて PASS。キットの生成の保護 31 件と、`judge.mjs` の折り畳みの判定 3 件 |
| `plugin/` | `kit-self-test.mjs plugin` | 63 件すべて PASS（`kit-self-test.json`・`output.txt`）。途中の 4 回の記録は `earlier-run*.json`（下記） |
| `dry-run/` | `kit-self-test.mjs dry-run` | 5 件すべて PASS。キットを自分の Vault `InkdropThemeTest` で開き、エミュレーション（phone）で検査とツアーを実行した。判定は 910 件、FAIL 52 件はすべて `device.environment`（実機ではないので FAIL が正しい）、ほかに FAIL なし。ツアーは 38 ステップ |
| `rejudge/` | `judge.mjs`（修正後）で再判定 | 再レビューのキットの試運転（`../rereview/final/kit-dry-run-emulated.json` の元の結果）は FAIL 54 件になる。増えた 2 件は `device.ed-prepared`（SD・KD の `ed-fold`、`folded: false`） |

## build（キットの生成）

- 新しい出力先: キット・zip・マーカーができる。マーカーのハッシュがすべて一致し、プラグインに同じ kit id が入り、zip の中のマーカーも同じ kit id。作業用のフォルダは残らない。
- 止まることを確かめたもの（すべて終了コード 1、理由を表示、出力先の下のファイル・フォルダ・リンクの大きさ・更新時刻・ハッシュが前後で同一）:
  - 同じ出力先にもう一度（`--replace` なし）
  - キットでない同名のフォルダ（ノート入り）。`--replace` ありでもなしでも
  - 端末の結果（`device-results/`）が入ったキット、生成後に変更したキット、キットにないフォルダが加わったキット、種類の違うマーカー（いずれも `--replace` あり）
  - zip でない同名のファイル、キットでない zip、生成後に項目を加えたキットの zip
  - 同名のシンボリックリンク（リンク先も変わらない）
  - Vault の中（祖先に `.obsidian` がある）の出力先。何も作らない
- 生成したままのキットは `--replace` で置き換わり、新しい kit id になる。

## plugin（Vault の照合）

ケースごとに隔離インスタンスを起動し直した。

| ケース | プラグイン | `cable.mjs` |
|---|---|---|
| 正しいテスト Vault | 照合を通る | `probe` が動き、`shot` は撮影を 1 回呼ぶ |
| Vault 名が `OtherVault`（マーカーは正しい） | 拒否 | probe・checks・tour・pull・shot がすべて止まり、撮影は 0 回 |
| マーカーなし（同名の普通の Vault にプラグインを入れた場合と同じ） | 拒否 | 同上 |
| マーカーが JSON でない | 拒否 | 同上 |
| マーカーの種類が違う | 拒否 | 同上 |
| マーカーの kit id がプラグインと違う | 拒否 | 同上 |

拒否のケースでは、`runChecks()`・`runTour()` の直接の呼び出しと、コマンドからの実行の両方で次を確かめた: 理由を返し、`refused` に記録し、通知（4 件）に理由を出す。Vault のファイル（`device-results/` を作らないことを含む）、`app.vault.config`、テーマ、ワークスペースのレイアウト、body のクラス、開いているファイルが変わらない。

途中の記録:

- `earlier-run1.json`: `plugin.other-name.no-setting-or-workspace-change` が FAIL した（body のクラスの差。どのクラスかは記録していなかった）。Obsidian は、ウィンドウが macOS のフォーカスを持つかで body の `is-focused` を付け外しする（`app.js`）。ケースごとに Obsidian を起動し直しているので、その影響と推定したが、確かめてはいない。このクラスだけを比較から外し、差があるときは付いた・外れたクラスを記録するようにした。外した後の実行（`earlier-run4.json` と最終）では、ほかのクラスに差はなかった。
- `earlier-run2.json`: `cable.mjs` がプラグインの照合も使うように変えた後、テストの期待するメッセージを直していなかったため、`marker-other-kind` の 5 件が FAIL した。止まるべきところでは止まっていて、撮影は 0 回。
- `earlier-run3.json`: `is-focused` を外す前の全件 PASS。
- `earlier-run4.json`: `is-focused` を外した後の全件 PASS。この後、`--replace` で古いキットを消す処理を、マーカーに載ったファイルだけを消すように直した。最終の `plugin`・`dry-run`・`build` は、その最終のコードで取り直した。

## dry-run と rejudge（判定の変化）

- 今回の試運転は、CDP のフォーカスの再現を保って実行した（端末ではフォーカスがあるため）。再レビューのときの試運転は保っていなかった。そのため、`ed-fold` の折り畳みが起きず、`ed.fold.*`（`extra`、6 件）は「要素なし」で N/A になっていた。今回は 6 件とも PASS で、N/A は 4 件。iPhone の 2 回目と同じ件数と項目になった。
- このとき `device.ed-prepared` は PASS のままだった。端末の判定（`judge.mjs`）が、デスクトップの `runner.ed-prepared` と違って、折り畳まれたこと（`folded`）を条件にしていなかったため。準備に失敗したことが N/A に隠れていたので、`judge.mjs` を直した。`rejudge/` のとおり、再レビューの試運転は 2 件 FAIL になる。
- iPhone の結果は変わらない。`device-run2/results-*.json` を修正後の `judge.mjs` で判定し直すと、`report.json` と全 910 件で状態と詳細が同一（PASS 795、FAIL 0、DIFF 101、UNSUPPORTED 10、N/A 4）。当時のキットは `folded` を記録しておらず、`ed.fold.*` は実機で PASS している。`device-run1` も、修正前と後の `judge.mjs` で同一の判定になる。
