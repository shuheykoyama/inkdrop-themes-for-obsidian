# 工程 11G G4: Solarized Dark の macOS の本物の全画面（2026-10-20）

[14](../../../14-implementation-plan.md) §6.69 の証拠。

- ユーザーの承認（今回の G4 に限る）のもとで行った。
- 使ったのは、E43 の隔離インスタンス（Obsidian 1.14.4、Electron 43.7.7、Hidden frame）とテスト Vault だけ。
- 普段の Obsidian・Vault・Inkdrop、表示の設定（解像度・配置・壁紙など）には触れていない。

| ファイル | 内容 |
|---|---|
| `run.txt` | 元のコミット（`f487870`、作業ツリーは clean）、SD の `theme.css` の SHA-256、ユーザーに手を止めてもらった時刻と、デスクトップに戻った時刻 |
| `g4.mjs` | 測定のスクリプト（`prep`: SD を入れ、不透明と translucent を読む。`full`: 全画面に入って読み、出て読む） |
| `g4.json` | 4 つの状態（`opaque`、`translucentBefore`、`during`、`after`）の計算値、`isFullScreen()`、body のクラス |
| `spaces.sh`・`spaces-*.json` | macOS の Space の設定（`com.apple.spaces`）を読むだけで数えた、種類ごとの項目数（0 は通常、4 は全画面）。中身は記録していない |

## 結果

- 全画面に入った: `isFullScreen()` が true、`is-fullscreen` が付いた。
- 全画面を出た: `isFullScreen()` が false、`is-fullscreen` が外れた。
- 測った 12 の面すべてで、次の 3 つが成り立った。
  - 全画面の中の値が、不透明の値と同じ。
  - 出たあとの値が、全画面の前の translucent の値と同じ。
  - 不透明と translucent の値が違う（対照）。
- 対象の面: Ribbon、Ribbon の角、ステータスバー、左右のドックの葉と中身、左右と中央のタブ帯、エディタ、Vault 名の領域。

## 片付け

- 隔離インスタンスを止めた。プロセスは残っておらず、ポート 9333 は空いている。
- LaunchServices を戻し、`check` の出力が作業の前と同じであることを確かめた。出力は利用者のパスを含むので、入れていない。
- **Space**:
  - 全画面の Space（種類 4）は、前・出た直後・片付けのあと、のどれでも 0。
  - 通常の Space の項目数は、前と出た直後が 21、片付けのあとが 23。この増え方は、ユーザーが作業を再開したあとの操作によるものか、ここからは断定できない。
  - そのため、ユーザーに Mission Control を見てもらい、残っている Space がないことを確かめた（2026-10-20）。
