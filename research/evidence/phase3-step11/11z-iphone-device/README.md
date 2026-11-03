# iPhone 実機検証（最終キット `b2a24a48…`、2026-11-04）

[14](../../../14-implementation-plan.md) §6.190 の証拠。ユーザーの「準備できました」のあと、既存の手順（`tests/device/cable.mjs`、`judge.mjs`、`drawer-header.py`）だけで実行した。キット・CSS・spec・期待値・許容差は変えていない。製品の CSS は、この検証の間に変えていない。

## 環境（実測）

- 端末: iPhone13,3（iPhone 12 Pro）、iOS 27.0（`pymobiledevice3 usbmux list` の ProductVersion）。Obsidian 1.14.5（`apiVersion`、UA の `obsidian/1.14.5`。UA の `iPhone OS 18_7` は WebKit が固定している値で、実際の iOS ではない）。画面 390×844、倍率 3、`isPhone`・`isIosApp`・`isMobile` が true。
- pymobiledevice3 11.29.0（検証済みの版）。トンネルと Web インスペクタの CDP（127.0.0.1:9244）を私が起動し、終わって停止した。
- キット: kit id `b2a24a48-cb52-49fd-9aed-fd1aaafb2f73`、ZIP の SHA-256 `79f592fcabb533e718288680d034a5b3b38670e3a92a5ff61ff701c9bc9c55dd`（送る前に照合し、固定の値と一致）。ZIP 内のマーカーの kit id も一致。CSS は SD `7e4936c6…`、KD `2d5556d6…`（キット内のファイルのハッシュ、前工程で確定）。
- 安全: `cable.mjs probe` が、開いている Vault が `InkdropThemeTest` で、キットのマーカーがあり、プラグインの kit id と合うことを確かめた（合わなければ止まる）。Vault は通常の Vault とは別。同名の旧 Vault は、ユーザーが `InkdropThemeTest-step11p` に名前を変えて退避（`-step10` は元のまま）。上書き・削除はしていない。

## 結果

- **`checks`**（電話のジョブ。7 分 15 秒）: 916 件。**PASS 806、FAIL 0、DIFF 96、UNSUPPORTED 10、N/A 4**（`report.json`、`judge.txt`）。`device.environment` を含めて FAIL 0（実機では `device.environment` が PASS）。デスクトップの検査を端末で測ったものが 410 件。
- DIFF 96: 構文の色の忠実度（`syn.*.fidelity`）。デスクトップ・エミュレーションと同じ種類・同じ件数で、既知の扱い。UNSUPPORTED 10: Mermaid の 7 種類が `filter` のまま（テーマ対象外）。N/A 4: `ui.toggle.on-user-accent`、`ui.font.user-override-first`（電話にない要素）。**DIFF・UNSUPPORTED・N/A は期待値や許容差を変えずにそのまま記録した。**
- **ツアー**: 38/38 撮影（SD 19、KD 19。`shots/`、1170×2532）。キーボードの段（12・31）は、ユーザーが 2 回タップ。`drawer-header.py`: 4 段すべて PASS（SD 左 dE 0.013、右 0.010、KD 左 0.014、右 0.009、許容 1.0）。
- 画像: 38 枚すべてを、6 枚ずつの並べ（縮小）で目で見た。欠け・重なり・操作不能・表示崩れは見つからなかった。通知の写り込みなし（ステータスバーに時刻・電波・電池・おやすみモードのアイコンだけ）。個人の情報はない。縮小して見たので、細部（1 画素の差など）は見ていない。
- **角丸 3 規則のモバイルへの影響**: 実機の結果の中で、規則が当たるはずの要素（コマンドパレットの `.prompt`、メニュー）は、モバイルで Obsidian 自身の見た目（クイックスイッチャー 18・37 は大きい角丸、行は全幅の選択）で、デスクトップの値（24 / 7px）に変わった様子はない。ただし、実機の Computed Style を規則の有無で比べたわけではない（比較は前工程のタブレットのエミュレーションで済み、実機では変化なし）。

## 生の結果

`results-2026-11-03T18-28-15-912Z.json.gz`（結果の JSON。4.3 MB を gzip。時刻は UTC）、`tour-*.json`、`shots/shots.json`、`drawer-header.json`。

## 後片付け（Mac 側）

トンネルと CDP の中継を停止し、プロセスなしを確認。iPhone への接続は USB のまま（ケーブルは抜いていない）。**iPhone 側の設定（自動ロック、Safari の Web インスペクタ、おやすみモード）の復元と、テスト Vault の扱いは、ユーザーの確認待ち。**

## 確かめていないこと

- 実機の Computed Style の「3 規則あり・なし」の比較（キットは最終 CSS だけを持つ）。
- iPad 実機、Android、ほかの iOS・Obsidian の版。
- 画像の 1 画素単位の確認。
