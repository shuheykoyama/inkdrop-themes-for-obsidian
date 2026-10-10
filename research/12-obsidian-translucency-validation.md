# 12. Obsidian の半透明ウィンドウ（translucent）の再現可能性（V-04）

- 検証日: 2026-10-10
- 基準コミット: `635a699b4b3e95df342cbeabdae32e2ff77df828`（Phase 2B 補完、V-32 の完了時点）
- 対象: 09 V-04（Obsidian の translucent と Inkdrop の acrylic の比較）。Q-D22・Q-D1 の判断材料
- 前提（ユーザー確定済み、本書では再審議しない）: Q-D20、Q-D10、Q-D6、Q-D9、Q-D15、Q-D13、Q-D21、Q-D2（09 §0.1）
- 証拠: [`evidence/phase2-v04/`](evidence/phase2-v04/README.md)（ネイティブキャプチャ、Computed Style、画素の計測値、診断用 CSS、ツール）
- **本書は Q-D22・Q-D1 を確定しない。** 診断用 CSS は検証のためのもので、テーマの実装ではない。

証拠の区分は 11 と同じ（VERIFIED / STATIC / INFERRED / BLOCKED）。本書では次の 3 種類の値を区別する。

| 種類 | 意味 | 記録 |
|---|---|---|
| **CSS 宣言値** | 診断用 CSS に書いた値 | `diagnostic-css/*.css` |
| **Computed Style** | Obsidian の DOM に適用された計算値 | `measurements/css-*.json`、`measurements/obsidian-*.json` |
| **Native Screenshot** | macOS のウィンドウサーバーが合成した画素（ディスプレイの色空間） | `screenshots/*.png`、`measurements/obsidian-v04-pixel-samples.csv` |

半透明のウィンドウでは、この 3 つが一致しないのが普通である。

---

## 1. 検証目的とスコープ

- **目的**: Obsidian の translucent で、Inkdrop の acrylic 表示（11 §15）を技術的・視覚的にどこまで再現できるかを確かめる。
- **実施したこと**:
  - translucent の仕組み（Electron の設定と CSS の規則）の確認（静的解析と実測）。
  - translucent 時の CSS の優先関係の実測（公式変数、スコープ再定義、直接セレクタ、`!important`）。
  - Inkdrop の acrylic 用の宣言値を、診断用の暫定マッピングで当てた実測。
  - V-32 と同じ条件でのネイティブキャプチャと、領域ごとの画素の比較。
- **行っていないこと**: テーマの実装、配布用の `theme.css` の作成、Q-D22・Q-D1 の確定、モバイル実機の検証、システム設定（壁紙、「透明度を下げる」）の変更。

---

## 2. 対象環境・アプリバージョン

| 項目 | 値 |
|---|---|
| macOS | 26.5.2（build 25F84）、Intel（x86_64）、外観ダーク、「透明度を下げる」は無効（`reduceTransparency = 0`、読み取りのみ） |
| ディスプレイ | 内蔵、2048×1280 pt、倍率 2、カラープロファイル「Color LCD」（V-32 と同じ） |
| Obsidian | 1.14.4（アプリ本体の asar）。インストーラー 1.11.7、Electron 39.5.1、Chrome 142.0.7444.265（`navigator.userAgent`） |
| 起動方法 | 隔離インスタンス。専用の `--user-data-dir`（リポジトリ外の一時領域）にユーザー環境の `obsidian-1.14.4.asar` のコピーを置き、`--remote-debugging-port=9333 --remote-debugging-address=127.0.0.1` で起動した。ユーザーの Obsidian（別プロセス）・Vault・設定には触れていない |
| テスト Vault | 11 と同じ検証用 Vault（`evidence/phase2-p0/obsidian/test-vault/` のコピー、ノート 4 件）。テーマは診断用の `P2B-Diagnostic` |
| ウィンドウ | 1200×700 pt、位置 (400, 250)（`electronWindow.setBounds`）。左右ドックの幅は 260 pt に固定。`body` は `theme-dark`、`mod-macos`、`is-frameless`、`is-hidden-frameless` |
| 背景 | V-32 と同じ検証用背景ウィンドウ（`evidence/phase2-p0/tools/backdrop.swift`、1400×900 pt、位置 (300, 150)。`gray` は sRGB (128, 128, 128)、`pattern` は 100 pt 幅の 6 色の縦縞）。壁紙は変えていない |
| 撮影 | `/usr/sbin/screencapture -x -R400,250,1200,700`（2400×1400 px、無加工）。CDP のスクリーンショットは使っていない |
| translucent の切り替え | テスト Vault の設定として `app.customCss.setTranslucency(true / false)`（Obsidian の設定画面の「Translucent window」と同じ処理）。再起動は不要だった |

V-32（Inkdrop）との条件の差: アプリのレイアウトが違う（Obsidian は Ribbon・タブ帯・ステータスバーを持つ）。マテリアルの種類が違う（§3）。それ以外（OS、ディスプレイ、ウィンドウの位置と大きさ、背景ウィンドウ、撮影方法）は同じ。撮影時刻は V-32 の約 30 分後で、同じ壁紙・同じセッションである。

---

## 3. Obsidian の translucent の仕組み

### 3.1 Electron の設定（STATIC、`obsidian-1.14.4.asar` の読み取り）

| 項目 | Obsidian 1.14.4 | Inkdrop 6.1.5（11 §15.5） |
|---|---|---|
| 作成時の `BrowserWindow` | `backgroundColor: "#00000000"`、`frame` / `titleBarStyle` は設定に従う。`transparent` と `vibrancy` は指定しない | `transparent: true`、`backgroundColor: '#00000000'`、`vibrancy: 'under-window'`、`visualEffectState: 'active'` |
| translucent を有効にしたとき | レンダラーが `electronWindow.setBackgroundColor("#00000000")` と **`setVibrancy("sidebar")`** を呼び、`body` に `is-translucent` を付ける | （acrylic は起動時に決まる。切り替えには再起動が必要） |
| 無効にしたとき | `is-translucent` を外し、`setVibrancy(null)` | — |
| `visualEffectState` | 指定なし。Electron の既定は `followWindow`（ウィンドウが非アクティブのときマテリアルも非アクティブの見た目になる）[Electron docs: BaseWindowConstructorOptions](https://www.electronjs.org/docs/latest/api/structures/base-window-options) | `active`（常にアクティブの見た目） |
| 対象 OS | `process.platform === "darwin"` のときだけ（macOS 専用） | macOS と Windows 11 以降（`backgroundMaterial: 'acrylic'`） |

**マテリアルは同じではない**（`sidebar` と `under-window`）。ただし、この環境で実際に表示された下地の色はほぼ同じだった（§7.3）。静的に確認した設定と、表示された見た目は別の事実として扱う。

### 3.2 translucent 時の CSS の規則（STATIC、`app.css` 1.14.4。実測で確認）

| 規則（app.css の行） | 内容 |
|---|---|
| `body.is-translucent`（L3292） | `background-color: transparent` |
| `.is-translucent:not(.is-fullscreen) .titlebar, .app-container`（L6575–6578） | `background-color: var(--workspace-background-translucent)`。既定は `color-mix(in oklch, var(--mono-0) 60%, transparent)`（ダークでは黒の 60%）。**`!important` なし** |
| `.is-translucent:not(.is-fullscreen)` の 10 個のセレクタ（L6579–6591） | `.workspace-ribbon.mod-primary`、`.workspace-tabs`、`.workspace-split`、`.sidebar-toggle-button`、ドックと `.mod-top` の `.workspace-tab-header-container`、`.workspace-tabs .workspace-leaf`、`.workspace-sidedock-vault-profile`、`.workspace-ribbon.mod-primary:before` を **`background-color: transparent !important`** |
| `.is-translucent .workspace`（L6658） | `background-color: transparent` |
| `.is-translucent:not(.is-fullscreen)`（L6570） | `--divider-color: rgba(0, 0, 0, 0.15)` など 3 変数 |

`!important` の対象に入っていない層: `.workspace-leaf-content`、`.view-header`、`.view-content`、`.nav-header`、`.nav-files-container`、`.status-bar`。中央のノート領域は `.workspace-split.mod-root .view-content { background-color: var(--background-primary) }`（L4663）が効いたままなので、**Obsidian 既定の translucent では、半透明になるのは Ribbon・タブ帯・左右ドックだけで、ノート領域とステータスバーは不透明のまま**である（実測、§4）。フルスクリーン時（`.is-fullscreen`）は上の規則が外れる（STATIC、未実測）。

### 3.3 既定ダークでの実測（VERIFIED、`measurements/css-case-0-default-*.json`）

| 層 | 不透明 | translucent |
|---|---|---|
| `body` | `rgb(28, 28, 28)` | 透明 |
| `.app-container` | 透明 | `oklch(0 0 none / 0.6)`（黒の 60%） |
| Ribbon、左右の `.workspace-split`・タブ帯・`.workspace-leaf`、vault profile | `rgb(40, 40, 40)` など | すべて透明 |
| 中央 `.view-header` / `.view-content` | `rgb(28, 28, 28)` | `rgb(28, 28, 28)`（不透明のまま） |
| `.status-bar` | `rgb(40, 40, 40)` | `rgb(40, 40, 40)`（不透明のまま） |

---

## 4. CSS の優先関係と `transparent !important` の実測（VERIFIED）

各パターンの診断用 CSS を読み込み、translucent の有効・無効の両方で Computed Style を測った（`tools/probe-case.sh`、全層の一覧は `measurements/css-summary.csv`）。目印の色は半透明（α 0.5 など）にした。描画結果は translucent 有効時のネイティブキャプチャで確認した（`screenshots/obsidian-<case>-translucent-gray-active.png`）。

| パターン | セレクタと宣言 | 競合した app.css の規則 | Computed Style（translucent 時） | 描画結果 | 副作用 | 保守性 | 判定 |
|---|---|---|---|---|---|---|---|
| **A 公式変数** | `.theme-dark { --background-primary / --background-secondary / --ribbon-background / --titlebar-background / --tab-container-background }` | §3.2 の `transparent !important` | `--background-primary` だけが中央の `.view-header` / `.view-content` に反映。`--background-secondary` はステータスバーだけ。Ribbon・タブ帯・ドックは透明のまま | 中央だけ赤く塗られた | `--background-primary` を半透明にすると、`body` やポップオーバーなど他の消費先も半透明になる（不透明時の `body` が `rgba(255, 0, 0, 0.5)` になった） | 高（公式変数のみ） | **PARTIAL**（中央のみ） |
| **A2 translucent 用の変数** | `.theme-dark { --workspace-background-translucent: … }` | なし（`!important` なし） | `.app-container`（ウィンドウ全体の下地）に反映 | 半透明の領域すべてに一様にかかった。中央は不透明のまま | 全面に効くため、面ごとの塗り分けはできない | 中（公式の変数一覧には未掲載） | **VERIFIED**（全体の下地の制御） |
| **B スコープ再定義** | `.mod-left-split` / `.mod-right-split` に `--background-secondary`・`--tab-container-background`、`.mod-root` に `--background-primary`、File Explorer に `--background-secondary` | 同上 | `.mod-root` の `--background-primary` だけが `.view-content` に反映。ドック側は透明のまま。`.view-header` は `--file-header-background` が `body` で解決済みのため変わらない（`.mod-root` で `--file-header-background(-focused)` も再定義すると反映、`case-D-*`） | 中央の本文だけ | なし | 中 | **PARTIAL**（中央のみ） |
| **C1 直接（通常）** | `.workspace-split.mod-left-split { background-color }` など | `!important` に負ける | 透明 | 変化なし | — | — | **不成立** |
| **C2 直接（詳細度を上げる）** | `body.is-translucent:not(.is-fullscreen) .workspace .workspace-split.mod-left-split { … }` など | 同上（詳細度では `!important` に勝てない） | 透明 | 変化なし | — | — | **不成立** |
| **C3 直接 `!important`** | `.is-translucent:not(.is-fullscreen) .workspace-split.mod-left-split { … !important }` など | 同じ重要度で、後から読み込まれ詳細度も高いテーマが勝つ | 指定どおり（例: `rgba(255, 0, 0, 0.5)`） | 左ドック全体（タブ帯を含む）・Ribbon・右ドックが塗られた | `!important` が必要。app.css が対象を変えたら追従が要る | 低〜中（`!important` と非公開クラス） | **VERIFIED** |
| **C4 強制されない層** | `.mod-left-split .workspace-leaf-content`、`.mod-right-split .workspace-leaf-content`、`.mod-root .view-content` に `background-color`（`!important` なし） | なし | 指定どおり | 左右ドックの本体と中央が塗られた。**タブ帯・Ribbon・vault profile は塗られない** | なし | 中（`.workspace-leaf-content` は docs 未掲載だが安定した構造） | **VERIFIED**（本体のみ） |
| **D 実際の半透明色** | §5 の SD / KD の acrylic 宣言値 | 同上 | 宣言どおりの `rgba`（§6） | §7 | §5 | §5 | **VERIFIED** |

**要点**

- 変数に値を入れること（例: `--background-secondary` の再定義）は成立するが、translucent 時はその変数を使う要素（`.workspace-split` や `.workspace-leaf`）自体が `transparent !important` になるため、**描画には表れない**。
- `!important` なしで半透明の面を描けるのは、強制対象外の層（`.workspace-leaf-content`、`.view-content`、`.view-header`）と `.app-container`（変数経由）。ドックのタブ帯・Ribbon・vault profile を塗るには `!important` が要る（C3）。理由は、app.css 側がそれらを `!important` で透明にしているためで、詳細度では勝てない（C2）。
- 部分的に透明な色（α < 1）を置いた場合、マテリアルの効果は保たれた（§7。下地の揺らぎが残る）。不透明な色を置けば、その面ではマテリアルは見えなくなる。

---

## 5. Inkdrop の acrylic 配色を当てた結果（VERIFIED）

### 5.1 診断用の暫定マッピング（Q-D1 の決定ではない）

| Obsidian の領域 | Inkdrop の面 | SD（不透明 / acrylic） | KD（不透明 / acrylic） |
|---|---|---|---|
| 左ドック本体 | サイドバー | `hsl(192deg 81% 14%)` / `hsl(192deg 100% 11% / 50%)` | `hsl(60deg 9% 6%)` / `hsl(60deg 9% 6% / 50%)` |
| 右ドック本体 | ノートリスト | `hsl(192deg 100% 11%)` / `hsl(192deg 100% 8% / 70%)` | `hsl(0deg 4% 9%)` / `hsl(0deg 4% 9% / 70%)` |
| 中央のノート領域 | エディタ | `hsl(192deg 100% 8%)` / `hsl(192deg 100% 8% / 90%)` | `hsl(45deg 7% 11%)` / `hsl(45deg 7% 11% / 90%)` |

値は Inkdrop 6.1.5 が適用する HSL 宣言（`data/inkdrop-*-tokens.csv` の `conditional-overrides`）。Inkdrop の acrylic では `--page-background: transparent` なので、Obsidian 側も `--workspace-background-translucent: transparent` にした。

### 5.2 診断用 CSS の構成（`diagnostic-css/case-D-sd.css`、`case-D-kd.css`）

1. `.theme-dark` に 3 色の診断用変数（不透明の値）を置き、`.theme-dark.is-translucent:not(.is-fullscreen)` で acrylic の値に差し替える。同じセレクタで `--workspace-background-translucent: transparent`。
2. 不透明時: `.mod-left-split` / `.mod-right-split` の `--background-secondary`（V-16 の方式 2）と、`.mod-root` の `--background-primary`・`--file-header-background`・`--file-header-background-focused`。
3. translucent 時: `.is-translucent:not(.is-fullscreen) .mod-left-split .workspace-leaf-content` と右ドックの同じ要素に `background-color`（C4 の方式、`!important` なし）。中央は 2. の変数がそのまま効く。
4. 比較用の `case-D-sd-important.css` は、3. に加えてドックのタブ帯・Ribbon・中央のタブ帯を `!important` で塗る。

### 5.3 求めた結果への回答

| 確認事項 | 結果 |
|---|---|
| 1. 3 色を独立に適用できるか | **できる**（Computed Style で左 `rgba(0, 45, 56, 0.5)`、右 `rgba(0, 33, 41, 0.7)`、中央 `rgba(0, 33, 41, 0.9)`。KD も同様） |
| 2. 透明度を保てるか | **保てる**（計算値に α が残り、画素にもマテリアルの揺らぎが残る） |
| 3. CSS 変数だけで成立するか | **しない**。中央はスコープ再定義した変数で成立するが、左右ドックは `.workspace-leaf-content` への直接指定が必要 |
| 4. 直接セレクタが必要か | **必要**（`.workspace-leaf-content`。docs 未掲載のクラス構造への依存） |
| 5. `!important` が必要か | ドック本体と中央には**不要**。ドックのタブ帯・Ribbon・vault profile まで塗るなら**必要** |
| 6. 他の UI の背景が不自然にならないか | `!important` なしの場合、タブ帯・Ribbon・vault profile は素のマテリアル（灰色、§7.3）のまま残る。SD では青緑の面の上に灰色の帯が見える。ステータスバーは不透明の `--background-secondary` のまま（Obsidian の既定どおり）。`--background-primary` を `body` 全体で半透明にするとポップオーバー等も半透明になるため、`.mod-root` に限定した |
| 7. translucent を無効にすると通常の表示に戻るか | **戻る**。同じ CSS のまま translucent を有効→無効にしたあとの Computed Style は、最初から無効の場合と全層で一致した（`css-case-D-*-toggle-back-to-opaque.json`）。画面上もマテリアルは消えた（`setVibrancy(null)`） |

---

## 6. Computed Style（VERIFIED、translucent・アクティブ）

| 層 | SD（`case-D-sd`） | KD（`case-D-kd`） | Inkdrop V-32 の同じ面（11 §15.3） |
|---|---|---|---|
| `.app-container` | 透明 | 透明 | ページ: 透明 |
| 左ドック `.workspace-leaf-content` | `rgba(0, 45, 56, 0.5)` | `rgba(17, 17, 14, 0.5)` | サイドバー: SD `rgba(0, 45, 56, 0.5)` / KD `rgba(17, 17, 14, 0.5)` |
| 右ドック `.workspace-leaf-content` | `rgba(0, 33, 41, 0.7)` | `rgba(24, 22, 22, 0.7)` | ノートリスト: SD `rgba(0, 33, 41, 0.7)` / KD `rgba(24, 22, 22, 0.7)` |
| 中央 `.view-header` / `.view-content` | `rgba(0, 33, 41, 0.9)` | `rgba(30, 29, 26, 0.9)` | エディタ: SD `rgba(0, 33, 41, 0.9)` / KD `rgba(30, 29, 26, 0.9)` |
| ドックのタブ帯、Ribbon | 透明（`!important` 版では面の色） | 透明 | 該当なし |

両アプリの Computed Style は、対応する面で同一の値になった。撮影の直前と直後の値は全画像で同じだった（`measurements/obsidian-*.json`）。

---

## 7. Native Screenshot と Inkdrop V-32 との比較

### 7.1 撮影一覧

| 状態 | ファイル（`evidence/phase2-v04/screenshots/`） |
|---|---|
| 既定ダーク・不透明 | `obsidian-0-default-opaque-gray-active.png` |
| 既定ダーク・translucent（灰 / 縞 / 非アクティブ） | `obsidian-0-default-translucent-{gray-active,pattern-active,gray-inactive}.png` |
| SD 診断配色（不透明 / translucent 灰 / 縞 / 非アクティブ） | `obsidian-D-sd-{opaque-gray-active,translucent-gray-active,translucent-pattern-active,translucent-gray-inactive}.png` |
| KD 診断配色（同上） | `obsidian-D-kd-…`（同じ 4 状態） |
| SD 診断配色 + `!important` 版 | `obsidian-D-sd-important-translucent-gray-active.png` |
| パターン A・A2・C3・C4 の描画確認 | `obsidian-{A-official-vars,A2-workspace-translucent-var,C3-direct-important,C4-unforced-layers}-translucent-gray-active.png` |

計 17 枚。全画像を目視で確認し、写っているのは検証用 Vault だけであることを確かめた。撮影中に 1 枚、非アクティブ化の手順の途中で他のアプリのウィンドウが前面に出て写り込んだ画像があったため、リポジトリに含めずに破棄し、手順を直して（非アクティブ化のあとに `electronWindow.moveTop()` でフォーカスを変えずに最前面へ戻す）撮り直した。

### 7.2 領域ごとの画素（VERIFIED、ディスプレイ色空間の合成値。CSS の値ではない）

`tools/sample-regions.py` で、文字や部品のない矩形（ウィンドウ内の pt 座標。左ドック (60, 200, 220, 420)、右ドック (960, 240, 220, 400)、中央 (850, 130, 80, 520) など）の平均と標準偏差を求めた。色差は、画素値を sRGB とみなして CIELAB（D65）に変換し、CIE76 と CIEDE2000 で計算した（キャプチャはディスプレイのプロファイルのままで sRGB に変換していないので、近似である）。比較先は V-32 の灰色背景・アクティブの値。全件は `measurements/obsidian-v04-pixel-samples.csv`。

**Solarized Dark（translucent、灰色背景、アクティブ）**

| 領域 ↔ Inkdrop の面 | Obsidian の平均 RGB（標準偏差） | Inkdrop V-32 | ΔE76 | ΔE2000 |
|---|---|---|---|---|
| 左ドック ↔ サイドバー | (22.9, 44.1, 49.2)（1.1, 0.7, 0.4） | (22.5, 43.8, 48.5) | 0.39 | 0.36 |
| 右ドック ↔ ノートリスト | (13.1, 35.8, 41.2)（0.4, 0.4, 0.4） | (13.3, 35.8, 40.8) | 0.24 | 0.21 |
| 中央 ↔ エディタ | (5.1, 33.0, 41.0)（0.3, 0, 0） | (5.4, 33.3, 41.3) | 0.15 | 0.09 |

**Kanagawa Dragon（同条件）**

| 領域 ↔ Inkdrop の面 | Obsidian の平均 RGB（標準偏差） | Inkdrop V-32 | ΔE76 | ΔE2000 |
|---|---|---|---|---|
| 左ドック ↔ サイドバー | (30.6, 29.6, 28.6)（1.0, 0.7, 0.6） | (30.1, 29.2, 28.2) | 0.21 | 0.18 |
| 右ドック ↔ ノートリスト | (30.1, 28.0, 28.2)（0.4, 0, 0.4） | (30.3, 27.8, 27.9) | 0.20 | 0.24 |
| 中央 ↔ エディタ | (31.0, 30.0, 28.0)（0, 0, 0） | (31.4, 30.4, 28.4) | 0.20 | 0.13 |

**参考: 不透明の診断配色と V-32（acrylic）の差**: SD は左ドック ΔE2000 5.01、右ドック 4.60、中央 1.07。KD は左ドック 3.95、右ドック 1.89、中央 0.86。

**背景・フォーカスの影響**

| 条件 | 結果 |
|---|---|
| 背景を灰色 → 縞 | SD・KD の診断配色では、左右ドック・中央の平均値の差は 0.1 以内（撮影の間隔は約 9 秒）。既定ダークでは左ドックの R が最大 1.2 違った（撮影の間隔は約 2 分で、原因は未特定）。どちらも縞の柄は画面に現れず、V-32 と同じく背後のウィンドウの柄は合成に反映されない |
| アクティブ → 非アクティブ | **変わる**。マテリアルが均一で明るめの灰色になり（タブ帯の素の色が (43, 42, 43) 前後 → (51, 50, 52)、揺らぎ 0）、各面も明るくなる（SD 左ドック (26, 48, 54)、V-32 比 ΔE2000 1.51。KD 左ドック (34, 33, 33)、1.46）。Inkdrop は `visualEffectState: 'active'` で非アクティブでも変わらない（11 §15.4） |
| 既定ダーク・translucent | 左右ドックは (16.6〜17.9) 前後の暗い灰色（素のマテリアルに `.app-container` の黒 60% が重なる）。中央は (28, 28, 28) の不透明 |

### 7.3 素のマテリアルの色と、合成の一致の理由

`--workspace-background-translucent: transparent` で何も塗らない領域（ドックのタブ帯、Ribbon）は、マテリアルそのものの色になる。この環境では約 (42〜45, 42〜43, 42〜44) で、11 §15.6 が Inkdrop の合成値から逆算した下地（約 (44, 42, 41)）とほぼ同じだった。

つまり、この環境では、**Obsidian の `sidebar` マテリアル（アクティブ時）と Inkdrop の `under-window` マテリアルが、ほぼ同じ下地の色を出している**。両アプリで同じ `rgba` の面を重ねると、合成後の画素もほぼ一致した（ΔE2000 0.4 未満）。ただし、これは 1 つの壁紙・1 つの macOS 版での一致であり、マテリアルの種類は違うため、他の環境でも一致する保証はない（INFERRED）。

### 7.4 定性的な差

- **ウィンドウ上部と帯**: Obsidian にはドックのタブ帯、中央のタブ帯、Ribbon、vault profile、ステータスバーがあり、Inkdrop にない面が増える。`!important` なしでは、これらは素のマテリアル（中性の灰色）のまま残り、SD では青緑の面の上下に灰色の帯が見える。`!important` 版では面の色でそろうが、帯の境目がなくなる。
- **奥行き**: 3 つの面の明度の関係は V-32 と同じ（SD はサイドバー > ノートリスト > エディタの順で差が小さい。KD はほぼ平坦）。Obsidian のレイアウトでは「ノートリスト」に当てた面が右端に来るため、左から右への並びは Inkdrop と違う（Q-D1）。
- **フォーカス**: Obsidian は非アクティブ時にマテリアルが変わり、面が明るく平坦になる。Inkdrop は変わらない。Obsidian 側から `visualEffectState` を変える手段は、テーマの CSS にはない。
- **境界線**: 両アプリとも面の境界線の色は検証の対象外（既定のまま）。

---

## 8. Q-D22 の技術評価（決定ではない）

| 評価軸 | (a) 不透明配色のみ | (b1) acrylic の合成後を不透明色で近似 | (b2) Obsidian の translucent で acrylic を再現 | (c) 通常は不透明、translucent 時は acrylic の宣言値 |
|---|---|---|---|---|
| Inkdrop への忠実度 | Inkdrop の不透明表示と一致（V-30）。macOS 既定の Inkdrop とは SD で ΔE2000 最大 5 程度の差 | acrylic の見た目に近い一様な色。マテリアルの揺らぎ・ぼかしはない | アクティブ時は V-32 と ΔE2000 0.4 未満（この環境）。非アクティブ時は約 1.5 の差 | translucent の利用者には (b2) と同じ、それ以外には (a) と同じ |
| 再現可能性 | 確実（V-16） | 確実（不透明色を置くだけ） | 利用者が translucent を有効にした場合だけ | (a) と (b2) の両方 |
| macOS 環境による差 | なし | 値が 1 つの環境の画素値に固定される。他の壁紙・OS 版では Inkdrop の実際の見た目とずれうる | マテリアルは OS が描くので、環境の差は Inkdrop と同じ方向に出る見込み（ただしマテリアルの種類が違う） | 同左 |
| 他 OS・モバイル | 全環境で同じ | 全環境で同じ | Obsidian の translucent は macOS のみ。Windows・Linux・モバイルでは別の配色が要る | 不透明配色が他の環境の受け皿になる |
| Obsidian のユーザー設定との整合 | translucent を有効にした利用者には Obsidian 既定の透過がかかる（テーマが何もしない場合、ドックは既定の黒 60% の下地） | translucent の設定を無視して不透明にすることになる | translucent の設定に従う | 設定に自然に従う |
| CSS の保守性 | 高（公式変数 + V-16 の方式） | 高 | 中（`.workspace-leaf-content` への直接指定、`--workspace-background-translucent` は未掲載の変数） | 中（(a) + (b2) の分岐。分岐は `.is-translucent` の 1 条件） |
| 非公開セレクタへの依存 | V-16 の方式に準じる | 同左 | `.workspace-leaf-content`、`.is-translucent`、未掲載の変数 | 同左 |
| `!important` | 不要 | 不要 | ドック本体と中央は不要。タブ帯・Ribbon を塗るなら必要 | 同左 |
| 実装・テストの複雑さ | 低 | 低（値の出典が画素値で、Q-D2 の例外扱いが要る） | 中（translucent の有効・無効、フォーカスの有無で検証） | 中〜高（2 系統の検証） |
| 将来の Obsidian 更新への耐性 | 高 | 高 | 中（translucent の CSS 規則やマテリアルが変わると影響） | 中 |

### 8.1 問いへの回答

- **Q1. Obsidian の translucent は、Inkdrop の acrylic を再現する基盤として使えるか。** → **使える（条件付き）**。この環境では、アクティブ時の下地の色が Inkdrop とほぼ同じで、Inkdrop の `rgba` 宣言値をそのまま置くと合成結果も ΔE2000 0.4 未満で一致した。条件は (1) 利用者が translucent を有効にしていること、(2) macOS であること、(3) 非アクティブ時の見た目の違い（Obsidian は変わる、Inkdrop は変わらない）を許容すること。
- **Q2. Inkdrop の元の RGBA/HSL 宣言値で、両アプリで視覚的に近い結果が得られるか。** → **得られる**（この環境、アクティブ時、面の本体）。変換や補正は不要だった。帯（タブ帯・Ribbon・ステータスバー）は Inkdrop にない面で、比較の対象外。
- **Q3. `transparent !important` を回避するために、どの程度の上書きが必要か。** → 面の本体だけなら `!important` は**不要**（`.workspace-leaf-content` と `.view-content` への指定、`--workspace-background-translucent` の再定義）。ドックのタブ帯・Ribbon・vault profile まで面の色にするなら、それらに `!important` が**必要**（4 セレクタ程度、`case-D-sd-important.css`）。
- **Q4. (c) の両対応を、1 つのテーマ CSS で自然に切り替えられるか。** → **できる**。`.is-translucent:not(.is-fullscreen)` の 1 条件で値を差し替える診断用 CSS で、有効・無効の切り替え（再起動なし）に追従し、無効に戻すと最初から不透明の場合と同じ計算値になった。
- **Q5. Q-D22 を確定できるだけの証拠が揃ったか。** → **技術面では揃った**（各案の成立・不成立、必要な CSS、見た目の差が実測で分かった）。残る不確実性は環境依存（壁紙、他の macOS 版、「透明度を下げる」、Apple Silicon）と、Obsidian の帯をどう扱うかというデザイン判断で、どちらも案の成立そのものは変えない。

### 8.2 技術面の推奨候補（決定ではない）

**(c)** を技術的な推奨候補とする。根拠:

1. Inkdrop 自身の構造（不透明が基本で、acrylic は条件付きの上書き）と同じ形になり、Q-D2（宣言値が正本）を守れる。(b1) のように画素値を配色にする必要がない。
2. translucent 時の再現度が実測で高い（ΔE2000 0.4 未満）。
3. 不透明配色が、translucent を使わない利用者と、Windows・Linux・モバイル（Q-D10）の受け皿になる。
4. 切り替えは 1 条件で、`!important` なしで面の本体を描ける。

懸念: 検証の対象が 2 系統になる。帯（タブ帯・Ribbon）を `!important` で塗るかどうかは、別に決める必要がある。(a) だけでも忠実度の主要部分（不透明表示）は満たせるため、実装の負担を下げたい場合の代替になる。

---

## 9. Q-D1 への影響

translucent 有効時に成立する背景の割り当て（VERIFIED、デスクトップ）:

| 領域 | `!important` なし | `!important` あり | 方法 |
|---|---|---|---|
| 左ドック本体（ビューの中身） | 成立 | — | `.mod-left-split .workspace-leaf-content` |
| 右ドック本体 | 成立 | — | `.mod-right-split .workspace-leaf-content` |
| File Explorer だけ別色 | 成立（INFERRED: C4 と同じ層。`[data-type="file-explorer"]` で限定できる） | — | `.workspace-leaf-content[data-type="file-explorer"]` |
| File Explorer 内部の 2 色化（`.nav-header` / `.nav-files-container`） | 成立する見込み（強制対象外の層。未実測） | — | 11 §9 (g) |
| 中央のノート領域 | 成立 | — | `.mod-root` の `--background-primary`・`--file-header-background(-focused)` |
| ドックのタブ帯 | 不成立 | 成立 | `.mod-left-split .workspace-tab-header-container` など |
| Ribbon、vault profile | 不成立 | 成立 | `.workspace-ribbon.mod-primary`、`.workspace-sidedock-vault-profile` |
| ウィンドウ全体の下地 | 成立 | — | `--workspace-background-translucent`（未掲載の変数） |
| ステータスバー | 成立（不透明の規則がそのまま効く） | — | `--background-secondary` など |

- 不透明時に成立する方式（11 §8・§9）のうち、`.workspace-split` や `.workspace-leaf` に変数で色を渡す方式（(a)〜(c)、(e)）は、translucent 時には**そのままでは描画されない**。translucent 時は、同じ色を `.workspace-leaf-content` に渡す書き方が別に必要になる。
- (d)（タブ帯を別色）と (h)（Ribbon・タブ帯を含む組み合わせ）は、translucent 時には `!important` が前提になる。
- Q-D22 で (c) を選ぶ場合、Q-D1 の割り当ては「不透明時は変数で、translucent 時は `.workspace-leaf-content` で」同じ面の対応を 2 通りに書くことになる。割り当ての考え方自体は共通にできる。

---

## 10. 未確認事項・環境依存性

- 壁紙（デスクトップ画像）を変えたときの合成。マテリアルの種類が違う（`sidebar` と `under-window`）ため、環境によっては両アプリの下地がずれる可能性がある。壁紙はユーザーの承認なしに変えないため、変えていない。
- 「透明度を下げる」を有効にしたとき、ライト外観、他の macOS 版、Apple Silicon、外部ディスプレイ。
- フルスクリーン時（`.is-fullscreen` で translucent の規則が外れる。STATIC）。
- ポップアウトウィンドウ、モーダル、メニュー、ポップオーバーの translucent 時の見え方。
- File Explorer 内部の 2 色化（`.nav-header` / `.nav-files-container`）の translucent 時の実測。
- Windows・Linux・モバイル（Obsidian の translucent は macOS 専用。Q-D10 の環境では不透明配色が使われる）。
- 色差は、ディスプレイのプロファイルの画素を sRGB とみなした近似。数値が近いことは、同じ条件での一致を示すだけで、忠実度の全体を保証しない。

---

## 11. 次の設計判断への移行判定

**READY FOR Q-D22（技術面）**。各案の成立条件・必要な CSS・見た目の差は実測で揃った。残る不確実性は環境依存の範囲と、Obsidian にしかない帯の扱い（デザイン判断）で、どの案が技術的に成り立つかは変わらない。Q-D1 は、Q-D22 の選択に応じて、不透明時と translucent 時の書き分けを前提に判断できる。
