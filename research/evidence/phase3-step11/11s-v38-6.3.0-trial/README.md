# V-38（Inkdrop 6.3.0）の試しの 1 組（SD・灰色の背景・アクティブ、2026-11-03）

[14](../../../14-implementation-plan.md) §6.182 の証拠。ユーザーの「準備できた」のあと、`tests/visual/capture-inkdrop.sh`・`capture-obsidian.sh`（変更なし）と `tests/runtime/inkdrop-production.sh` で行った。**試しの 1 組だけで、本測定には進んでいない**（条件が成立しなかったため）。領域・許容差・検査方法は変えていない。結果は「Inkdrop 6.3.0 / Obsidian 1.14.5 / Electron 43.8.3」の補助の資料。Inkdrop 6.2.0 に対する V-38 は UNVERIFIED のまま。

## 条件

- Inkdrop: 6.3.0（`CFBundleShortVersionString` と、デバッグ接続の User-Agent `inkdrop/6.3.0`）。テーマ `solarized-dark`（インストール済み 2.2.1）が有効、`acrylic-window` あり。窓は 1 つだけ（6.3.0 の窓の復元で、複数の窓や別のノートは出なかった）。サンプルノートは「Basic writing and formatting syntax」（起動時に表示されていた。ノートの ID・リビジョン・`updatedAt`・題名が、前後で同じ）。更新の通知は出ていない（6.3.0 が最新）。
- Obsidian: 1.14.5、Electron 43.8.3（隔離インスタンス、`dist/solarized-dark/theme.css` = `f6b59e61…`、translucent）。
- 撮影: 窓 1200×700 を (400, 250)、灰色の背景 1400×900 を (300, 150)、`screencapture -x -R400,250,1200,700`。
- 後片付け: Inkdrop は通常の終了 → `config.json` を控えで戻し → 通常の起動（`RESTORED`、9334 閉）。隔離 Obsidian は停止、LaunchServices は `restore` 済み。強制終了なし。

## 画像（`screenshots/`、2 枚を目で確認）

どちらも、対象のアプリの窓だけが写っていて、ほかの窓・通知・個人の内容はない（Inkdrop はチュートリアルのノートと公開のサイドバー、Obsidian はテスト Vault）。

## 結果（`compare.csv`、SD のみ）

| Inkdrop の領域 | Obsidian の領域 | Inkdrop | Obsidian | ΔE2000 | 判定 |
|---|---|---|---|---|---|
| サイドバー | Ribbon | (31, 53, 58) | (31, 53, 58) | 0.00 | PASS |
| ノートリスト | 右ドック | (18, 41, 46) | (18, 41, 46) | 0.00 | PASS |
| ノートリスト | Vault 名の領域 | (18, 41, 46) | (18, 41, 46) | 0.00 | PASS |
| ノートリスト | 左ドックのタブ帯 | (18, 41, 46) | (18, 41, 46) | 0.00 | PASS |
| ノートリスト | 中央のタブ帯 | (18, 41, 46) | (18, 41, 46) | 0.00 | PASS |
| ノートリスト | **左ドック** | (18, 41, 46) | (19.6, 43.4, 49.0) | 0.8 | **測定無効**（Obsidian の標準偏差 12.42 > 1.0） |
| エディタ | **エディタ** | (7, 36, 42) | (6.7, 36.4, 42.6) | 0.18 | **測定無効**（Obsidian の標準偏差 1.93 > 1.0） |

Inkdrop 側の 3 領域は、すべて平ら（標準偏差 0）。更新の通知が出ないので、サイドバーの領域も平らだった。

## 条件が成立しなかった点（本測定を始めなかった理由）

1. **Obsidian の左ドックの領域が平らでない**（`v38-obsidian.json` の (60, 200, 220, 420)）。この領域は、ファイル一覧の行にかかる。V-38 を行った `52434a5` のテスト Vault は 4 つのノート（`Folder A/In folder`、`Folder A/Sub/Deep`、`Other note`、`Sample note`）だけだったが、いまの `tests/fixtures/vault` は、`Code blocks`・`Editor chrome`・`half-transparent.png`・`Markdown elements`・`Mermaid`・`Sample note` などが増え、一覧が y=200 より下まで伸びる。テーマの値の問題ではない。
2. **Obsidian のエディタの領域が平らでない**（(850, 260, 80, 390)）。最終の CSS では、見出し 1 の背景の帯が、この領域の左端にかかる（帯は x 336〜908、領域は x 850〜930）。Vault を `52434a5` のものに戻しても、この点は変わらないと見る。
3. **ディスプレイの構成が V-38 のときと違う**: いまのメインのディスプレイは外付けの LG（1920×1080、倍率 1）で、ほかに Acer（縦置き）と内蔵の Retina がある。V-38（2026-10-11）は内蔵の Retina（3072×1920、倍率 2、色空間 Color LCD）で、画像は 2400×1400 px だった。今回の画像は 1200×700 px。両アプリとも同じディスプレイで撮ったので、組の比較は成り立つが、V-38 の記録の条件（`conditions.json`）とは違う。

領域・許容差は、独断で変えていない。ユーザーとレビューの判断が要る（§6.182）。

## 確かめていないこと

- KD、灰色・非アクティブ、柄・アクティブの撮影（本測定に進んでいない）。
- Inkdrop 6.2.0 との比較（UNVERIFIED）。
- 内蔵の Retina をメインにした条件での撮影。
