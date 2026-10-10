# V-04 検証の証拠（Obsidian の translucent と Inkdrop の acrylic）

[`research/12-obsidian-translucency-validation.md`](../../12-obsidian-translucency-validation.md) の根拠となる、スクリーンショット・測定結果・診断用 CSS・ツールを置く。

- 取得日: 2026-10-10
- **ここにある CSS と JS はすべて診断用で、テーマの実装ではない。** 配布用の `theme.css` ではない。
- スクリーンショットに写っているのは、検証専用の一時テスト Vault（ノート 4 件、`../phase2-p0/obsidian/test-vault/` のコピー）だけである。全画像を目視で確認した。

## 検証環境

| 項目 | 値 |
|---|---|
| OS | macOS 26.5.2（build 25F84）、Intel（x86_64）、ダーク、「透明度を下げる」は無効（読み取りのみ） |
| Obsidian | 1.14.4（アプリ本体の asar）。インストーラー 1.11.7、Electron 39.5.1、Chrome 142.0.7444.265 |
| 起動方法 | 隔離インスタンス（専用の `--user-data-dir`、リポジトリ外）。`--remote-debugging-port=9333 --remote-debugging-address=127.0.0.1`。ユーザーの Obsidian（別プロセス、稼働中のまま）・Vault・設定には触れていない（`obsidian.json` と `md.obsidian.plist` の更新日時が作業前と同じことを確認） |
| ウィンドウ | 1200×700 pt、位置 (400, 250)、倍率 2。左右ドックの幅 260 pt |
| 背景 | `../phase2-p0/tools/backdrop.swift`（1400×900 pt、位置 (300, 150)）。`gray` = sRGB (128, 128, 128)、`pattern` = 100 pt 幅の 6 色の縦縞 |
| 撮影 | `/usr/sbin/screencapture -x -R400,250,1200,700`（ウィンドウサーバーの合成結果、ディスプレイの色空間「Color LCD」）。2400×1400 px、無加工 |

## ファイル

### `diagnostic-css/`（診断用 CSS）

| ファイル | 目的 |
|---|---|
| `case-0-default.css` | 空（Obsidian 既定のダーク） |
| `case-A-official-vars.css` | パターン A: 公式変数だけ（`.theme-dark` で定義） |
| `case-A2-workspace-translucent-var.css` | translucent 時に `.app-container` が使う変数 `--workspace-background-translucent`（公式一覧には未掲載） |
| `case-B-scoped-vars.css` | パターン B: 領域ごとのスコープ再定義 |
| `case-C1-direct-plain.css` / `case-C2-direct-specific.css` / `case-C3-direct-important.css` | パターン C: 強制透明の層への直接指定（通常 / 詳細度を上げる / `!important`） |
| `case-C4-unforced-layers.css` | 強制透明の対象外の層（`.workspace-leaf-content`、`.view-content`）への直接指定 |
| `case-D-sd.css` / `case-D-kd.css` | パターン D: Inkdrop の不透明と acrylic の宣言値（HSL）を、診断用の暫定マッピングで当て、`.is-translucent` で切り替える |
| `case-D-sd-important.css` | `case-D-sd` に加えて、ドックのタブ帯・Ribbon・中央のタブ帯を `!important` で塗る |

### `measurements/`

| ファイル | 内容 |
|---|---|
| `css-<case>-<opaque\|translucent>.json` | 各ケースの Computed Style（全層の `background-color`、`body` のクラス、主要な変数）。`tools/probe-case.sh` |
| `css-case-D-<sd\|kd>-toggle-back-to-opaque.json` | translucent を有効にしたあと無効に戻した直後の Computed Style（切り替えの確認） |
| `css-summary.csv` | 上の JSON（トグル以外）を 1 表にまとめたもの。`tools/summarize-css.py` |
| `obsidian-<case>-<mode>-<背景>-<フォーカス>.json` | 各スクリーンショットのメタデータ（撮影方法・時刻・画素数・SHA-256 の全桁・矩形・フォーカス・診断用 CSS）と、撮影直前・直後の Computed Style |
| `obsidian-v04-pixel-samples.csv` | 背景だけの領域の画素の平均と標準偏差、Inkdrop V-32 との色差（ΔE76、ΔE2000）。**ディスプレイの色空間の合成値で、CSS の値ではない**。`tools/sample-regions.py` |

### `screenshots/`（ネイティブキャプチャ）

ファイル名は `obsidian-<case>-<translucent|opaque>-<gray|pattern>-<active|inactive>.png`。

| ファイル | SHA-256（先頭 16 桁） |
|---|---|
| `obsidian-0-default-opaque-gray-active.png` | `ad19de48b48607dd` |
| `obsidian-0-default-translucent-gray-active.png` | `aa509b7d65be8498` |
| `obsidian-0-default-translucent-gray-inactive.png` | `3fffa087e23a5393` |
| `obsidian-0-default-translucent-pattern-active.png` | `6b2b23283b8a217f` |
| `obsidian-A-official-vars-translucent-gray-active.png` | `f3ebde30b3261616` |
| `obsidian-A2-workspace-translucent-var-translucent-gray-active.png` | `b4f251d0e17f23a3` |
| `obsidian-C3-direct-important-translucent-gray-active.png` | `5b5a5dcd9a9b09eb` |
| `obsidian-C4-unforced-layers-translucent-gray-active.png` | `d04837555a5e30ea` |
| `obsidian-D-sd-opaque-gray-active.png` | `bec944fd81bc2cd6` |
| `obsidian-D-sd-translucent-gray-active.png` | `bc78cd733faa8e6f` |
| `obsidian-D-sd-translucent-pattern-active.png` | `6f389a2fde6755c9` |
| `obsidian-D-sd-translucent-gray-inactive.png` | `8f38f09de89f69bd` |
| `obsidian-D-sd-important-translucent-gray-active.png` | `0f95561ce02642b0` |
| `obsidian-D-kd-opaque-gray-active.png` | `e0deb386581d195d` |
| `obsidian-D-kd-translucent-gray-active.png` | `0ed028ac8ba096f9` |
| `obsidian-D-kd-translucent-pattern-active.png` | `29a8c6483b4a2f7b` |
| `obsidian-D-kd-translucent-gray-inactive.png` | `2142106c25e45a1a` |

### `tools/`

| ファイル | 内容 |
|---|---|
| `obsidian-setup.js` | テスト Vault のレイアウト（サンプルノート、左に File Explorer、右に Outline、ドック幅 260 pt）、translucent の切り替え（`window.__V04.translucent`）、ウィンドウの位置と大きさの固定 |
| `probe-translucency.js` | 全層の Computed Style と、`body` のクラス・フォーカス・ウィンドウの状態を読む（読み取り専用。診断用テーマを再読み込みする） |
| `probe-case.sh` | 1 ケース × 1 モードの Computed Style の測定 |
| `obsidian-focus.js` | 隔離インスタンス自身の Electron API（`app.focus({ steal: true })`、`moveTop`、`focus`）で前面化。AppleScript は使わない（ユーザーの Obsidian は同じアプリなので、アプリ名での操作を避けた） |
| `obsidian-raise.js` | フォーカスを変えずに最前面へ（非アクティブの撮影用） |
| `obsidian-v04-capture.sh` | 1 枚分の撮影（CSS の読み込み → レイアウト → 背景ウィンドウ → フォーカス → ネイティブキャプチャ → 撮影前後の Computed Style → メタデータの JSON） |
| `summarize-css.py` | Computed Style の JSON を表にまとめる |
| `sample-regions.py` | 領域ごとの画素の平均・標準偏差と、V-32 との色差（CIE76、CIEDE2000。画素を sRGB とみなした近似） |

## 再現手順

```sh
# 0. 背景ウィンドウをコンパイルする（V-32 と同じ）
swiftc -O ../phase2-p0/tools/backdrop.swift -o "$S/bin/backdrop"

# 1. 一時ディレクトリに隔離用の userData とテスト Vault を作る（既存の Vault を使わない）
mkdir -p "$S/w/userdata"
cp ~/Library/Application\ Support/obsidian/obsidian-1.14.4.asar "$S/w/userdata/"
cp -R ../phase2-p0/obsidian/test-vault "$S/w/vault"
#    $S/w/userdata/obsidian.json にテスト Vault だけを登録する:
#    {"vaults":{"v04diag000000001":{"path":"<$S/w/vault の絶対パス>","ts":0,"open":true}}}

# 2. 隔離インスタンスを起動する（ユーザーの Obsidian とは別プロセス）
/Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$S/w/userdata" \
  --remote-debugging-port=9333 --remote-debugging-address=127.0.0.1 &

# 3. Computed Style（ケース × モード）
tools/probe-case.sh case-C4-unforced-layers translucent "$S/w/vault" "$S"

# 4. ネイティブキャプチャ（画面収録の権限が必要。権限の変更はしない）
tools/obsidian-v04-capture.sh case-D-sd translucent gray active "$S/w/vault" "$S"
python3 -I tools/sample-regions.py measurements/obsidian-v04-pixel-samples.csv screenshots/*.png

# 5. 終了は、起動した隔離インスタンスのプロセスだけを止める
```

## 注意

- 撮影中に 1 枚、非アクティブ化の手順の途中で他のアプリのウィンドウが撮影範囲の前面に出て写り込んだ画像があった。その画像と測定 JSON はリポジトリに含めず破棄し、手順に `obsidian-raise.js` を加えて撮り直した。リポジトリにある画像はすべて目視で確認済み。
- 画素値（`obsidian-v04-pixel-samples.csv`）と Computed Style（`*.json`）は別の種類の証拠である。
- 比較先の Inkdrop の値は `../phase2-p0/measurements/inkdrop-v32-pixel-samples.csv`（11 §15.4）。
