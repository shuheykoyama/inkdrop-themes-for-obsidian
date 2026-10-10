# Phase 2B P0 検証の証拠

[`research/11-runtime-validation.md`](../../11-runtime-validation.md) の根拠となる、スクリーンショット・測定結果・診断用ファイルを置く。

- 取得日: 2026-10-10
- **ここにある CSS と JS はすべて診断用で、テーマの実装ではない。** 優先関係を測るための目印の色（sentinel colour）を書いたもので、Inkdrop の配色とは関係がない。
- スクリーンショットに写っているのは、検証専用の一時テスト Vault（ノート 4 件）だけである。ユーザーの Vault・ノート・設定は含まない。

## 検証環境

| 項目 | 値 |
|---|---|
| OS | macOS 26.5.2（build 25F84）、Intel（x86_64） |
| Obsidian | 1.14.4（アプリ本体の asar）。インストーラーは 1.11.7、Electron 39.5.1、Chrome 142.0.7444.265（`navigator.userAgent` で確認） |
| 起動方法 | 隔離インスタンス。専用の `--user-data-dir`（scratchpad 内、リポジトリ外）に、ユーザー環境の `obsidian-1.14.4.asar` のコピーを置いて起動し、`--remote-debugging-port` で接続した。ユーザーが起動中の Obsidian（別プロセス）・既存の Vault・設定ファイルには触れていない（`obsidian.json` と `md.obsidian.plist` の更新日時が起動前のままであることを確認） |
| テスト Vault | 一時ディレクトリに新規作成。ノート 4 件（`Sample note.md`、`Other note.md`、`Folder A/In folder.md`、`Folder A/Sub/Deep.md`）と、診断用テーマ `P2B-Diagnostic` だけを置いた。行番号表示はこの Vault でだけ有効にした |
| 表示 | ウィンドウ 1024×800 CSS px、`devicePixelRatio` 2（スクリーンショットは 2048×1600 px） |
| 外観 | ダーク（`theme-dark`）。`body` のクラスは `mod-macos`、`is-frameless`、`is-hidden-frameless` ほか（[measurements/probe-env.json](measurements/probe-env.json)） |
| Inkdrop（当初） | 未インストール。公開配布物 6.1.5（arm64 の zip）を展開した静的解析だけを行った（`research/data/inkdrop-consumers-6.1.5.csv`） |
| Inkdrop（2026-10-10 再開） | 6.1.5（x86_64）をユーザーがインストール・サインイン済み。ユーザーの承認を得て、リモートデバッグ（`127.0.0.1:9334` 限定）付きで再起動し、テーマの読み込み・検証用ノートの作成と削除・設定の一時変更を行った。すべて元に戻した（11 §14.2） |

## ファイル

### `obsidian/`（スクリーンショット、Obsidian 1.14.4 の実機キャプチャ、CDP の `Page.captureScreenshot`）

| ファイル | 内容 | SHA-256（先頭 16 桁） |
|---|---|---|
| `00-baseline-default-theme-layout.png` | 診断用テーマが空の状態（Obsidian 既定の dark）。左ドックに File Explorer、右ドックに Outline、中央にサンプルノート | `9405f24d3521eb40` |
| `01-case-A-sentinel-colours.png` | ケース A の診断用 CSS を読み込んだ状態。各領域が目印の色で塗られる | `af141fc47409e813` |
| `02-mobile-emulation-tablet-case-A.png` | `app.emulateMobile(true)`（タブレット）でケース A を読み込んだ状態。左ドロワーを開いている | `c91c2208a9c4ae01` |
| `03-mobile-emulation-tablet-case-C.png` | 同じくケース C（ドロワーを塗る変数の再定義） | `a70ee5a4222beb6d` |

画面の色は、テスト用の目印の色をそのまま撮ったもので、色の測定値としては使っていない（色の判定は下の Computed Style で行った）。

### `obsidian/test-vault/`（検証専用のテスト Vault の内容）

サンプルノート 4 件、`appearance.json`（診断用テーマを選ぶだけ）、診断用テーマの `manifest.json`。検証時に Obsidian が自動で作った `app.json`、`core-plugins.json`、`workspace*.json` は含めていない。テーマの `theme.css` は、測定ケースごとに `obsidian/diagnostic-theme/` のファイルをコピーして使う。

### `obsidian/diagnostic-theme/`（診断用 CSS）

| ファイル | 目的 |
|---|---|
| `case-A-cascade.css` | V-01（`.theme-dark` / `body` / `body.theme-dark` / `.mod-macos` との優先関係、`!important`）と V-16 の方式 2〜4（左右ドック、File Explorer 内部、タブ帯） |
| `case-B-mobile-drawers.css` | ケース A ＋ モバイルのドロワーでの `--background-secondary` の再定義 |
| `case-C-mobile-drawer-variable.css` | ケース B ＋ ドロワーを実際に塗る `--mobile-sidebar-background` の再定義 |

### `measurements/`（CDP の `Runtime.evaluate` で取得した Computed Style）

| ファイル | 取得時の状態 | スクリプト |
|---|---|---|
| `probe-env.json` | 既定の状態（実行時は端末に出力しただけだったため、セッションの出力をそのまま保存した。ファイル内の `_note` に明記） | `tools/probe-env.js` |
| `v03-dom-baseline.json` | 診断用テーマが空の状態 | `tools/probe-dom.js` |
| `v01-v16-case-A.json` | ケース A | `tools/probe-cascade.js` |
| `v16-titlebar.json` | ケース A | `tools/probe-titlebar.js` |
| `mobile-emulation-case-A.json` | ケース A、モバイルエミュレーション（タブレット） | `tools/probe-mobile-state.js` |
| `mobile-emulation-case-B.json` | ケース B、同上 | `tools/probe-mobile-drawers.js` |
| `mobile-emulation-case-C.json` | ケース C、同上 | `tools/probe-mobile-drawers.js` |

### `inkdrop/`（スクリーンショット、Inkdrop 6.1.5 の実機キャプチャ、CDP の `Page.captureScreenshot`）

すべて不透明表示（acrylic を一時的に無効化）、1024×800 CSS px、`deviceScaleFactor` 1（画像も 1024×800 px）。サイドバーは検証用ノートブックのワークスペースに絞り、写っているのは検証用ノートブック「Theme Validation (Phase 2B)」とノート「Sample note」だけである（目視で確認）。検証用データは撮影後に削除した。

| ファイル | 状態 | SHA-256（先頭 16 桁） |
|---|---|---|
| `sd-1-default.png` / `kd-1-default.png` | 既定（エディタにフォーカス、選択なし、行番号・アクティブ行は Inkdrop 既定の無効） | `b2e6916d1593d1bb` / `6a03c6ca9f52e66e` |
| `sd-2-notelist-focus.png` / `kd-2-notelist-focus.png` | ノートリストにフォーカス（選択項目の左 5px バー） | `3dbc7e68d924d153` / `21d911b5f9e5e2c4` |
| `sd-3-sidebar-hover.png` / `kd-3-sidebar-hover.png` | サイドバーのステータス行「Active」を hover（KD は状態 2 と同一の画素） | `448ba1179554befc` / `21d911b5f9e5e2c4` |
| `sd-4-editor-selection.png` / `kd-4-editor-selection.png` | 行番号とアクティブ行を一時的に有効化し、「bold」を選択 | `76d786a1d356424d` / `5df7a8374bf51014` |
| `sd-5-preview.png` / `kd-5-preview.png` | プレビュー | `e568b1862439888a` / `bee7277203826c11` |

対応する Computed Style は `measurements/inkdrop-<sd|kd>-<状態>.json`。acrylic（macOS 既定）表示の Computed Style は `measurements/inkdrop-<sd|kd>-acrylic.json`（スクリーンショットはなし）。静的予測との照合結果は `measurements/inkdrop-static-vs-runtime.csv`。

### `tools/`（診断用スクリプト）

| ファイル | 内容 |
|---|---|
| `cdp.mjs` | Chrome DevTools Protocol の最小クライアント（Node 22 以上）。`eval` で JS を評価、`shot` でスクリーンショット。接続先は URL の接頭辞で選ぶ（既定 `app://obsidian.md`、環境変数 `CDP_URL_PREFIX` で変更） |
| `setup-layout.js`、`setup-lines.js` | テスト Vault のレイアウト（ノートを開く、左右ドックを展開、Outline を表示）と、行番号表示・カーソル位置の設定 |
| `probe-*.js` | 上の測定 |
| `enter-mobile-emulation.js`、`exit-mobile-emulation.js` | `app.emulateMobile(true / false)`。ウィンドウが再読み込みされる |
| `probe-inkdrop.js`、`probe-inkdrop-hover.js` | Inkdrop の各面・選択状態・エディタの Computed Style と DOM の親子関係を読む（読み取り専用。ノートの内容は読まない） |
| `inkdrop-create-test-note.js` | 検証用ノートブックとノートを 1 件ずつ作る（ユーザーの承認による） |
| `inkdrop-show-test-note.js` | サイドバーを検証用ノートブックのワークスペースに絞り、ノートを開く |
| `inkdrop-select-theme.js` | テーマを切り替える |
| `inkdrop-state.js` | 撮影状態（既定、ノートリストにフォーカス、エディタで選択、プレビュー）に切り替える。ノートの内容は変えない |
| `inkdrop-editor-chrome-on.js` / `inkdrop-editor-chrome-off.js` | 行番号とアクティブ行の強調を一時的に有効化 / 既定（無効）に戻す |
| `inkdrop-capture-theme.sh` | 1 テーマ分の撮影と測定（5 状態） |
| `inkdrop-restore.js` | 検証前の状態への復元（テスト用ノート・ノートブックの削除、設定の復元） |
| `compare-inkdrop.py` | 実機の Computed Style と、02 の宣言値（静的予測）を照合する |

## 再現手順（Obsidian）

```sh
# 1. 一時ディレクトリに隔離用の userData とテスト Vault を作る（既存の Vault を使わない）
W=$(mktemp -d)
mkdir -p "$W/userdata"
cp ~/Library/Application\ Support/obsidian/obsidian-1.14.4.asar "$W/userdata/"
cp -R obsidian/test-vault "$W/vault"
#    $W/userdata/obsidian.json にテスト Vault だけを登録する:
#    {"vaults":{"p2bdiag000000001":{"path":"<$W/vault の絶対パス>","ts":0,"open":true}}}

# 2. 隔離インスタンスを起動する（ユーザーの Obsidian とは別プロセス）
/Applications/Obsidian.app/Contents/MacOS/Obsidian --user-data-dir="$W/userdata" --remote-debugging-port=9333 &

# 3. レイアウトを整え、診断用 CSS を入れて測る
node tools/cdp.mjs 9333 eval tools/setup-layout.js
node tools/cdp.mjs 9333 eval tools/setup-lines.js
cp obsidian/diagnostic-theme/case-A-cascade.css "$W/vault/.obsidian/themes/P2B-Diagnostic/theme.css"
node tools/cdp.mjs 9333 eval tools/probe-cascade.js

# 4. 終了は、起動した隔離インスタンスのプロセスだけを止める
```

## 注意

- モバイルの結果は、デスクトップ上の `app.emulateMobile(true)` によるエミュレーション（タブレット判定）である。iOS / Android の実機では検証していない。
- Inkdrop の実機検証（V-30・V-20・V-22）は、当初は Inkdrop が未インストールのため行えなかった（11 §3・§4）。2026-10-10 にユーザーがインストールしたあと再開し、完了した（11 §14）。
- Inkdrop の acrylic（macOS 既定の半透明）表示のスクリーンショットは含まれていない（11 §14.8）。
- `cdp.mjs` の `eval` は、環境変数 `CDP_VIEWPORT=1024x800` を付けると、スクリーンショットと同じ表示サイズに固定してから評価する。`hovershot <out.png> <x> <y> [w h]` はマウスを移動してから撮影する。
