# 工程 4（translucent / acrylic）の証拠（2026-10-11）

[14](../../14-implementation-plan.md) §6.4 の証拠。すべて隔離した Obsidian（専用の `--user-data-dir` とテスト Vault の複製）で取得した。ユーザーの Vault・設定は開いていない。画像はテスト Vault の内容だけで、撮影ごとに目視で確認した。色の後処理はしていない。

## 環境

| 項目 | 値 |
|---|---|
| macOS | 26.5.2（V-04・V-32 と同じ Mac） |
| Obsidian | アプリ 1.14.4。Electron 39.5.1（`/Applications/Obsidian.app`、インストーラ 1.11.7）と Electron 43.7.7（現行インストーラのコピー、`tests/runtime/current-installer.sh`） |
| テーマ | このリポジトリの `dist/<theme>/theme.css`（開発用の仮名称） |
| Inkdrop（V-37 のみ） | 6.1.5。ユーザーの承認を得て、127.0.0.1:9334 限定のリモートデバッグで再起動。テーマパッケージ SD 2.2.1・KD 1.2.1（ユーザーがインストール済み）。acrylic は既定の有効のまま |

## 1. 実行時テスト（Computed Style、`runtime/`）

| ファイル | 内容 |
|---|---|
| `runtime-electron-39.5.1.json` / `runtime-electron-43.7.7.json` | `tests/runtime/run.mjs` の結果。251 件すべて PASS（うち 76 件は PASS（EMULATED））。各行に Electron の版・テーマ・プラットフォーム・外観（不透明 → translucent → 不透明）・状態・測定値・判定 |
| `self-test-electron-*.json` | ランナーの陰性テスト。127 件すべて宣言どおり（不透明のモバイル検査が translucent のウィンドウで走ると FAIL になること、を含む） |

## 2. ネイティブのスクリーンショットの比較（`visual/`）

撮影条件は V-04（[12](../../12-obsidian-translucency-validation.md) §7）・V-32（[11](../../11-runtime-validation.md) §15）と同じ: ウィンドウ 1200×700 pt を (400, 250) に置き、背後に制御した背景ウィンドウ（1400×900 pt、灰色または柄）を置いて、`/usr/sbin/screencapture -x -R400,250,1200,700` で撮る（ネイティブ同士の比較。CDP のスクリーンショットとは混ぜない）。撮影スクリプトは `tests/visual/capture-obsidian.sh`、測定は `tests/visual/sample-regions.py`（V-04 の関数を変更せずに再利用）。各 `measurements/*.json` に撮影時刻・画像の SHA-256・フォーカスの状態・ドック幅・Electron の版を記録した。

測る領域は背景だけの平坦な矩形（ウィンドウの pt 座標、`tests/visual/configs/step4-*.json`）。標準偏差が 1.0 を超える領域は測定無効として FAIL にする。Inkdrop 側の値は V-32（2026-10-10）の画素の実測値で、Q-D1 に合わせて Ribbon = サイドバー、ドック・Vault 名の領域・タブ帯 = ノートリスト、エディタ = エディタと対応させた。

### 2.1 結果（ΔE2000、Electron 39.5.1。43.7.7 も各チャンネルの差 1 以内で同じ）

| 撮影 | Ribbon | ドック・タブ帯・Vault 名の領域 | エディタ | 判定 |
|---|---|---|---|---|
| SD 不透明・灰色・アクティブ | 0.00 | 0.00 | 0.00 | **PASS**（閾値 1.0） |
| KD 不透明・灰色・アクティブ | 0.00 | 0.00 | 0.00 | **PASS** |
| SD translucent・灰色・アクティブ | 2.91 | 1.60 | 0.52 | **FAIL**（閾値 1.0）→ §2.2 |
| KD translucent・灰色・アクティブ | 3.19 | 1.65 | 0.50 | **FAIL** → §2.2 |
| SD translucent・灰色・非アクティブ | 0.92 | 0.40 | 0.75 | 記録のみ（判定しない） |
| KD translucent・灰色・非アクティブ | 1.12 | 0.52 | 0.73 | 記録のみ |
| translucent・柄・アクティブ（両テーマ） | — | 測定無効（標準偏差 4〜6） | 測定無効 | 記録のみ。Obsidian では背景の縞が透ける（Inkdrop の V-32 では透けなかった） |

### 2.2 translucent・アクティブの差は撮影環境の変化による（実測）

`v04-baseline-2026-10-11/` は、V-04 の診断用 CSS（`case-D-sd.css`・`case-D-kd.css`。同じ Inkdrop の acrylic の宣言値を塗る）を、今日、同じ条件で撮り直したもの。

- 同じトークンを塗った面どうし（テーマの Ribbon と case D の左ドック = サイドバーの acrylic、右ドック = ノートリストの acrylic、エディタ）は、**アクティブ・非アクティブとも、テーマと case D の画素が一致した**（各チャンネルの差 1 以内。`*/measurements/same-token-vs-v04-baseline-*.csv`、`tests/visual/same-token-check.py`）。
- 一方、case D の今日のアクティブ時の値は、V-04 当時（2026-10-10）の値から大きく変わった（例: SD の左ドック (22.9, 44.1, 49.2) → (32.0, 53.0, 58.0)、ΔE2000 で約 3）。非アクティブ時は V-04 当時とほぼ同じ（差 1〜3、8 ビット）。
- したがって、テーマは V-04 で検証した構成をそのまま再現しており、Inkdrop（V-32、2026-10-10）との差は、アクティブ時のウィンドウ素材（Obsidian の `sidebar` vibrancy）の下地が撮影日の間に変わったことによる。原因（壁紙、システムの外観の設定、その他）は調べていない（設定を変える調査はユーザーの承認が要る）。
- 今日の環境での Inkdrop の合成値はないため、**Inkdrop との絶対的な比較（アクティブ時）は UNVERIFIED**。同じ日に Inkdrop と Obsidian を撮り直せば判定できる（V-38、ユーザーの承認が必要）。
- **追記（同日、V-38）**: ユーザーの承認を得て、同じ時刻に Inkdrop と Obsidian を撮り直した。灰色・アクティブで 14 組すべて ΔE2000 0.00（PASS）。Inkdrop 自身の値も V-32 から同じだけ変わっていた。→ [`../phase3-v38/`](../phase3-v38/README.md)

## 3. V-37（`inkdrop-v37/`）

acrylic 表示の Inkdrop で、`:root` の Computed Style を読んだ（ユーザーの承認を得て実施。ノートの作成・撮影はしていない）。

| トークン | Solarized Dark | Kanagawa Dragon |
|---|---|---|
| `--editor-drawer-background` | `hsl(192deg 100% 11% / 70%)`（テーマの通常の宣言。基盤の acrylic の上書き `hsl(var(--hsl-neutral-800))` ではない） | `hsl(60deg 9% 6% / 70%)`（同上） |
| その他の acrylic の 7 トークン | パレットの `-acrylic` の値と一致 | 同左 |

→ 工程 2 の推論（基盤だけの acrylic の上書きは、テーマの上位のレイヤの宣言に負ける）は実測と一致した。`--editor-drawer-background-acrylic` は持たない。

復元: テーマを Solarized Dark（作業前の設定）に戻して Inkdrop を通常終了し、`config.json` を終了直後の控えで書き戻した（デバッグ用の起動が終了時にスクロール位置を書き込んだため 2 回書き戻した）。パッケージ一覧は作業前と同じ。Inkdrop はデバッグなしで通常起動し、9334 番ポートが閉じていることを確認した。
