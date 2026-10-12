# 工程 9（Mermaid）の証拠（2026-10-13）

[14](../../14-implementation-plan.md) §6.21 の証拠。

- Obsidian はすべて隔離したインスタンスで取得した（専用の `--user-data-dir` とテスト Vault の複製）。ユーザーの Vault・設定は開いていない。
- Mermaid の Vault ごとの確認は、隔離インスタンスのテスト Vault に限ってローカルストレージ（`mermaid-vault-trust`）で許可した。
- Inkdrop は起動していない。
- 画像はテスト Vault の内容だけで、すべて目視で確認した。色の後処理はしていない。

## 環境

- macOS 26.5.2、Obsidian 1.14.4（同梱の Mermaid 11.13.0）。
- Electron は 39.5.1（`/Applications/Obsidian.app`）と 43.7.7（現行インストーラのコピー）。
- テーマは工程 9 の `dist/<theme>/theme.css`（開発用の仮名称）。
- 検証用ノートは `tests/fixtures/vault/Mermaid.md`。内容は次のとおり。
  - Flowchart（各形のノード、点線・太線のエッジ、ラベル、サブグラフ）
  - 利用者の `style`・`classDef`・`linkStyle` 付きの Flowchart
  - Sequence（autonumber、participant・actor、活性化、ノート、loop・alt、`-x`）
  - 非対応の 7 図種
  - 画像
- Inkdrop 側の正本は次の 3 つ。
  - `inkdropapp/mermaid@384e9f5` の `packages/mermaid/src/theme.ts`（themeVariables と `--mermaid-*` の対応）
  - `inkdropapp/css@add48d9` の `mermaid.css`
  - 各テーマの `preview.css`

## ファイル

| パス | 内容 |
|---|---|
| `step8-rv5-39.5.1/` | 工程の最初の確認。RV5 で直した Reading view の 4 クラスの、両テーマのネイティブの撮影 6 枚。トークンの位置（`rv5-token-rects.json`、`rv5shots.mjs`）と、字形の画素の色と期待色の ΔE2000（`rv5-token-colours.csv`、`rv5measure.py`）。12 対象すべて 0.53 以下 |
| `gutter-border-39.5.1/` | ユーザーの指示で KD のガターの右線を削除した後の撮影（Source mode・Live Preview）と、Q23-5 の測定（`q23/`、PASS） |
| `v10/v10-reading.json`、`v10/v10-live.json` | V-10 の DOM の記録（`v10.mjs`）。図ごとの ID・`aria-roledescription`・親要素の鎖とフィルタ・SVG 内の `<style>`・要素の種類ごとの色とインラインの指定 |
| `v10/sentinel.json` | themeVariable ごとに別の色を与えて描き、要素ごとに色を逆引きした結果（`sentinel.mjs`。Mermaid 11.13.0、base テーマ） |
| `v10/inkdrop-theme-ts-tokens.json` | Inkdrop の `theme.ts` から取り出した themeVariable → `--mermaid-*` の対応（129 件）。実行時テストは、このうちパレットにある 32 件を `tests/spec/mermaid.json` に持つ |
| `runtime/runtime-electron-*.json` | 実行時テスト（`mm.*` を含む全検査） |
| `runtime/self-test-electron-*.json` | ランナーの陰性テスト（`mm.self-test` を含む） |
| `native-39.5.1/`、`native-43.7.7/` | ネイティブの撮影 |

ネイティブの撮影の内訳は次のとおり。

- 39.5.1（16 枚）: 両テーマ × 次の 8 枚。
  - Reading view・Live Preview の Flowchart と Sequence
  - Source mode
  - 非対応の図種（Class・State）
  - translucent の Reading view の Flowchart と Sequence
- 43.7.7: 両テーマ × Reading view・Live Preview の Flowchart と Sequence。

撮影は画面が起きてロックが解除された状態で行い、ディスプレイを起こす操作はしていない。撮影の間だけ、自分で起動した `caffeinate -d -u`（時間制限付き）でアイドル扱いを防いだ。

Flowchart の右端がペインで切れるのは、図の幅が本文の幅を超えるため。テーマを外しても同じになる（Obsidian の挙動）。
