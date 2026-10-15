# 工程 10（モバイル実機）の証拠（2026-10-13）

[14](../../14-implementation-plan.md) §6.23 の証拠。

- 実機は iPhone 12 Pro（iOS 27.0）だけ。iPad は今回の対象外、Android は端末がないため BLOCKED。
- iPhone ではテスト専用の Vault `InkdropThemeTest`（`tests/device/build-kit.mjs` のキット）だけを開いた。ユーザーの普段の Vault・Sync・iCloud には触れていない。
- 端末のシリアル番号・識別子は記録していない（結果ファイルにも含まれない）。
- デスクトップは隔離したインスタンス（専用の `--user-data-dir` とテスト Vault の複製）で実行した。Inkdrop は起動していない。
- 画像はテスト Vault の内容だけで、すべて目視で確認した。切り抜き・縮小・色の後処理はしていない（`navbar-compare.png` は下記のとおり切り抜いて並べたもの）。

## 環境

| 実行 | 端末・アプリ | 受け渡し |
|---|---|---|
| 1 回目 | iPhone 12 Pro、iOS 27.0、Obsidian 1.14.4（iOS 版） | AirDrop。撮影はユーザー |
| 2 回目 | 同じ端末、Obsidian 1.14.5（iOS 版、間に自動で更新された） | ケーブル。`tests/device/cable.mjs` と pymobiledevice3 v11.29.0（撮影と Web インスペクタ） |
| デスクトップ | macOS 26.5.2、Obsidian 1.14.4、Electron 39.5.1 と 43.7.7 | — |

UA の OS は `iPhone OS 18_7` と出るが、iOS が固定している値で、実際の版は `xcrun devicectl` の 27.0。

## ファイル

| パス | 内容 |
|---|---|
| `device-run1/results-*.json`・`tour-*.json` | 1 回目の端末の測定値と、撮影ツアーの記録（当時のキット。ツアーは 40 ステップ） |
| `device-run1/report.json`・`judge.txt` | 1 回目の判定（`tests/device/judge.mjs`）。902 件、PASS 783、FAIL 6（すべて `extra`）、DIFF 101、UNSUPPORTED 10、N/A 2 |
| `device-run1/navbar-compare.png` | フローティングのナビゲーションバーの比較。上が SD、下が KD。左から、テーマの不透明な色（当時の実装）、Obsidian 標準の半透明（採用）、フローティングでないバー。1 回目のユーザーの撮影から切り抜いて並べた |
| `device-run2/results-*.json`・`tour-*.json` | 2 回目の測定値と撮影ツアーの記録（38 ステップ。ステップごとの保持の時間帯と、その時点のナビゲーションバーの計算値） |
| `device-run2/report.json`・`judge.txt` | 2 回目の判定。910 件、PASS 795、**FAIL 0**、DIFF 101、UNSUPPORTED 10、N/A 4 |
| `device-run2/shots/*.png` | 2 回目の撮影（1170×2532、ケーブル経由。ステップ番号とラベルがファイル名）。29 番は通知が写り込んだため入れていない |
| `device-run2/shots/shots.json` | 各撮影の開始と終了の時刻。ツアーの記録の時間帯と照らすと、31 番だけ終わりが 0.06 秒はみ出す |
| `dry-run/report-emulated.json` | Mac の隔離インスタンスのエミュレーション（phone）での試運転の判定。実機ではないので `device.environment` が 52 件 FAIL するのが正しい結果で、他の FAIL はない |
| `runtime/runtime-electron-*.json`・`self-test-electron-*.json` | デスクトップの実行時テストと陰性テスト（最終のコード、各 3581 件・413 件） |
| `runtime/failures-electron-39.5.1-run*.txt` | 39.5.1 で 3 回実行したときの FAIL の一覧（2・6・6 件、回ごとに違う検査。43.7.7 は 0 件） |

1 回目のユーザーの撮影（約 40 枚）は、通知や個人の画面が写る可能性があるため入れていない。比較に使った部分だけを `navbar-compare.png` にした。

## 再現

```sh
node tests/device/build-kit.mjs <out_dir>           # <out_dir>/InkdropThemeTest.zip（新しい出力先）
node tests/device/build-kit.mjs <out_dir> --replace # 作り直し: 前回のキットが生成したときのままの場合だけ置き換える
# 端末: 展開したフォルダを Vault として開き、制限モードを切り、"Inkdrop theme device check" を有効にする
#       （Vault 名を InkdropThemeTest から変えない。プラグインは名前とマーカーが合わないと何もしない）
node tests/device/judge.mjs <results-*.json> --out <report.json> --label "<端末, OS, アプリ>"
```

出力先にすでに `InkdropThemeTest/` か `InkdropThemeTest.zip` があると、`build-kit.mjs` は何も変えずに止まる。`--replace` を付けても、置き換えるのは、キットのマーカー（`.obsidian/inkdrop-device-kit.json`）に載っているファイルだけが生成時のハッシュのまま残っている場合だけ。端末で書いた結果（`device-results/`）やノートが入っていれば止まるので、必要なものを別の場所へ移してから、新しい出力先で作り直す。出力先が Obsidian の Vault の中（祖先に `.obsidian` がある）のときも止まる。安全対策の陰性テストは `node tests/device/kit-self-test.mjs build|plugin|dry-run <新しい作業フォルダ>`（§6.27、証拠は `rv6/`）。

ケーブルでつないだ iPhone では、次の 2 つを別のシェルで起動してから `cable.mjs` を使う（`cable.mjs` の冒頭の説明を参照）。検証済みの版は **pymobiledevice3 11.29.0**（`uv tool install pymobiledevice3==11.29.0`、iOS 27.0、macOS 26.5.2）。

```sh
pymobiledevice3 remote start-tunnel --native --script-mode   # "<host> <port>" を出す
pymobiledevice3 webinspector cdp --port 9244
node tests/device/cable.mjs 9244 reload                      # キットを入れ替えた後
node tests/device/cable.mjs 9244 checks <out_dir>
node tests/device/cable.mjs 9244 tour <host> <port> <out_dir>
```

## iPhone の設定の復元

| 項目 | 変更した人 | 復元 |
|---|---|---|
| 自動ロック（ツアーの間「なし」） | ユーザー | **ユーザーが元に戻したことを確認済み**（2026-10-13） |
| Safari の Web インスペクタ（オン） | ユーザー | **ユーザーがオフに戻したことを確認済み**（2026-10-13） |
| おやすみモード | ユーザー（任意） | **ユーザーが解除したことを確認済み**（2026-10-13） |
| このコンピュータの信頼（ペアリング） | ユーザー（接続時） | 未確認。今回の接続の前から信頼済みだったかは記録していない。解除は依頼していない（iPhone の「設定 → 一般 → 転送またはリセット → リセット → 位置情報とプライバシーをリセット」で解除できる） |
| 開発者モード | 変更していない（接続時にすでに有効） | 対象外 |
| テスト Vault `InkdropThemeTest`（制限モードの解除とプラグインの有効化を含む。設定はこの Vault の中だけ） | ユーザー | レビューが終わるまで残す。削除は「ファイル」→「このiPhone内」→「Obsidian」から |
