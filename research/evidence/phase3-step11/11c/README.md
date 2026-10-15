# 工程 11C（互換性）の証拠（2026-10-16）

[14](../../../14-implementation-plan.md) §6.45 の証拠。実行時テストの結果は、工程 11B の証跡（`../11b/`、Obsidian 1.14.4）を再利用している。最新の公開版が 1.14.4 のままで、再実行していないため。

| ファイル | 内容 |
|---|---|
| `inventory-1.14.4.json` | `node tests/compat/inventory.mjs obsidian-1.14.4.asar.gz --out …` の一覧。asar は公式リリース（`obsidianmd/obsidian-releases` の v1.14.4）。変数・クラス・属性・引用した規則ごとに、使っている箇所（src のファイル:行）と Obsidian 側の根拠（`app.css` の行、スクリプト名）がある |
| `inventory-1.14.4.txt` | 同じ実行の要約（問題 0） |
| `reference-1.13.7-against-1.14.4.txt` | 参考。手元の 1.13.7 の asar（読み取りのみ）を、1.14.4 の一覧に `--against` で照合した結果。照合の仕組みが実際の版の差を拾うことの実証で、1.13.7 は対応外 |
| `compat-self-test.txt` | 棚卸しの陰性テスト（24 件） |

asar 自体は証拠に入れていない（Obsidian の配布物のため）。公式の `obsidian-1.14.4.asar.gz` の SHA-256（base64）は `0e1CjDY5aHdPDzkG5n2KU6BY7OC2zdkksHhll3sq2iE=` で、`desktop-releases.json` の `hash` と一致する。展開した asar の SHA-256 は `146ef8470d8cbb4a6db209bdc19bf2bad13350444186c0fd93c31087b142b92f` で、11B の隔離インスタンスが読み込んだ asar と同じだった。
