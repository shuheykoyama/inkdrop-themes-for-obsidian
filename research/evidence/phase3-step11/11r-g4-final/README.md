# G4: 最終 CSS での macOS の実フルスクリーン（2026-11-03）

[14](../../../14-implementation-plan.md) §6.181 の証拠。ユーザーの「準備できた」のあと、`11i-g4v38/g4.mjs`（§6.152・§6.160・§6.165）で行った。Inkdrop・iPhone・通常の Obsidian と Vault には触れていない。

## 条件

- 隔離インスタンス: Obsidian 1.14.5、Electron 43.8.3（`~/.cache/inkdrop-themes-for-obsidian/obsidian-1.14.5/Obsidian.app` のコピー、`OBSIDIAN_ASAR=none`）、Hidden frame。テスト Vault の複製だけ。環境変数 `G4_EXPECT_APP=1.14.5`・`G4_EXPECT_ELECTRON=43.8.3`（`prep` の記録と、全画面の前の実際の窓の両方で一致を確認）。
- 最終の製品 CSS（コミット `b3d1989` 以降、`src/` は同じ。作業ツリーは clean）: SD `f6b59e61…`（138,326 文字）、KD `9cc55c6f…`（144,036 文字）。`prep` が、Obsidian が読み込んだテーマの名前、長さ、SHA-256 を `dist/<theme>/theme.css` と照合して一致。
- 前: Space は通常のみ 25、全画面の Space は 0（`spaces-before.json`）。`pmset -g therm` の CPU の制限なし。
- 窓が前に出ていた時間（UTC）: 08:23:57〜08:25:11。全画面に入っていた時間は、各テーマ数秒（`full-times.txt`）。

## 結果

- **KD**（`g4-kanagawa-dragon.json`）と **SD**（`g4-solarized-dark-2.json`）とも、`status: COMPLETE`。`enteredFullScreen`・`leftFullScreen` が true、全画面の中は `isFullScreen()` が true で `is-fullscreen` クラスあり、出たあとは false でクラスなし。Space の種類ごとの数は、前も出た直後も `{0: 25}`（`spacesRestored: true`）。
- **12 の面**（Ribbon、Ribbon の角、ステータスバー、左右のドックの葉と中身、左右と中央のタブ帯、エディタ、Vault 名の領域）はすべて、次の 3 つが成り立った（両テーマ）: 全画面の中の値が不透明の値と同じ、出たあとの値が全画面の前の translucent の値と同じ、不透明と translucent の値が違う（対照）。
- 全画面から出たあと、隔離インスタンスを止めた。プロセスは残らず、ポート 9333 は閉じた。

## 途中で起きたこと（SD の 1 回目）

`prep` を SD、KD の順に続けて行ったため、同じインスタンスに読み込まれたテーマが KD に替わり、SD の `full` は「`prep` のあとにテーマが変わった」として、**全画面に入る前に**拒否した（exit 1、`full-solarized-dark.log`、`g4-solarized-dark.json`）。既存の安全の検査が働いたもので、全画面は要求していない。SD の `prep` をやり直し（`g4-solarized-dark-2.json`）、そのあと `full` を行って COMPLETE になった。`g4-solarized-dark.json` は、拒否された記録として残す（判定には使わない）。次回は、テーマごとに `prep` と `full` を続けて行う。

## 後片付け

- **LaunchServices**: 実行のあとの `check` に、E43.8.3 のコピーが `obsidian://` の候補として 1 行（と、そのパスの 1 行）増えていた（`ls-after.txt`）。`current-installer.sh restore` で登録を外し、もう一度 `check` すると、作業の前と同じ出力に戻った（`ls-after-restore.txt`）。
- **Space**: 実行のあとも `{0: 25}`。**Space の数が同じでも、完全な復元の証明にはならない**ので、ユーザーによる Mission Control の確認が要る（残っている全画面の Space がないこと）。

## 確かめていないこと

- ユーザーの Mission Control の確認（この記録の時点では未確認）。
- 本物の画面の見た目（画素）。G4 は、計算値で面の色を確かめる検査。
- translucent で全画面に入った状態（G4 の対象外）。
