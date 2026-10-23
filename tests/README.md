# Test tooling: setup, running, restoring, known limits

Maintenance notes for everything under `tests/` (step 11F, research/14 §6.54). The README at the root lists the
commands in short; this file says what each one needs, what it touches, how to put things back, and what is
known to go wrong. Every Obsidian the tools drive is an **isolated instance**: its own temporary
`--user-data-dir` and a copy of `tests/fixtures/vault`. The user's vaults, settings, Inkdrop and devices are
never opened or changed by these tools; anything that would (a device, Inkdrop, a macOS display or Space
setting) is a separate step that needs its own approval each time.

## 1. What is needed

| What | Version verified | Used by | Notes |
|---|---|---|---|
| macOS | 26.5.2 | everything at runtime | The isolated instance, captures and LaunchServices are macOS only. CI runs the static tests on Linux |
| Node.js | 22.22.0 (22+) | all `.mjs` | `npm ci` installs the pinned dependencies (package-lock.json). Dependencies are not updated before RV7 without a clear defect or security reason (research/14 §6.53) |
| `/Applications/Obsidian.app` | installer 1.11.7 (Electron 39.5.1) | "E39" | Runs the 1.14.4 app from `~/Library/Application Support/obsidian/obsidian-1.14.4.asar`, which is copied read-only into the temporary user data dir |
| Current installer copy | Obsidian 1.14.4 (Electron 43.7.7) | "E43" | `bash tests/runtime/current-installer.sh prepare` downloads the official release, checks its digest and signature, and copies it to `~/.cache/inkdrop-themes-for-obsidian/` without launching it |
| Python 3 + Pillow | 3.12.6, Pillow 12.3.0 | `tests/visual/*.py` | Always run with `python3 -I` |
| Nushell | 0.116.0 | `tests/visual/*.nu` (reports) | Optional |
| pymobiledevice3 | 11.29.0 (latest on PyPI 2026-10-17: 11.33.0, not tried) | `tests/device/cable.mjs` only | Outside the repo: `uv tool install pymobiledevice3==11.29.0`, removed with `uv tool uninstall pymobiledevice3`. Keep 11.29.0 until a device step (11G) is approved; a newer version is tried on the cable driver's own probe first and recorded |

## 2. The isolated instance

```sh
W="$(mktemp -d)"                                   # a work dir of its own for every run
V="$(bash tests/runtime/obsidian-isolated.sh start "$W" | tail -1)"   # prints the vault path; CDP on 127.0.0.1:9333
# ... run a tool with --vault "$V" ...
bash tests/runtime/obsidian-isolated.sh stop "$W"  # stops only the process this start began (pid in $W)
```

- `start` refuses when port 9333 is in use (another isolated instance, or something else): one instance at a
  time. Several tools use 9333; `tests/device/kit-self-test.mjs` starts its own on 9335.
- Environments: E39 is the default. E43: put
  `OBSIDIAN_APP="$HOME/.cache/inkdrop-themes-for-obsidian/obsidian-1.14.4/Obsidian.app" OBSIDIAN_ASAR=none`
  in front of `start`. Around every E43 use run `bash tests/runtime/current-installer.sh check` before,
  `... restore` and `... check` after, and compare the two `check` outputs (the copy registers itself as a
  second `obsidian://` candidate; the default handler must stay `/Applications/Obsidian.app`).
- Window frame: `OBSIDIAN_FRAME=custom` (or `hidden`, `native`) in front of `start` writes `"frame"` into the
  temporary user data dir's `obsidian.json` before the start (Obsidian 1.14.4 reads it when the window opens:
  `ipcRenderer.sendSync("frame")`). The user's own Obsidian settings are not touched. The runner measures in
  such an instance only the checks made for that frame (`"frame": "custom"` in `tests/spec/runtime/*.json`).
- What the instance writes: only `$W` (user data, the vault copy, logs). The tools write themes into the vault
  copy (`.obsidian/themes/`), never elsewhere.
- The page is kept "focused" by CDP focus emulation (`holdFocus`), so the person at the Mac can keep working
  in other apps. A real pointer over the isolated window can still take a `:hover` away.
- Sleep: start the instance with the screen awake and keep the Mac awake for long runs (research/14 §6.25).
  The instance runs without background throttling, but a display that sleeps and wakes stalled a page once
  (11D, E43); a step that does not answer within its timeout fails and is run again in a fresh instance.

## 3. Runtime checks (`tests/runtime/run.mjs`)

| Command | What | Time (measured 2026-10) |
|---|---|---|
| `node tests/runtime/run.mjs --vault "$V" --out <f.json>` | every check of `tests/spec/runtime/*.json` for both themes: desktop opaque / translucent / opaque again, then the tablet, phone and phone-nonfloating emulation; the syntax and Mermaid dumps | about 20 min |
| `... --self-test` | the runner's negative tests (`tests/runtime/self-test-spec.json` and the syntax / Mermaid cases in `run.mjs`): each case declares PASS or FAIL | about 12 min |
| the same in an `OBSIDIAN_FRAME=custom` instance | the custom-frame checks only (title bar), desktop | under 1 min |

- Statuses: PASS, PASS (EMULATED) (tablet / phone emulation; never a device result), FAIL, DIFF (syntax
  fidelity), UNSUPPORTED (Mermaid kinds the theme does not colour). The exit status is 1 when anything FAILs.
- `INK_PROGRESS=1` prints every step with the time to stderr (to see where a run stopped).
- The result file records `environment` (Obsidian, Electron, frame). Give it to `tests/release/gate.mjs`
  through `tests/release/inputs.json` (kind `desktop-runtime`); a custom-frame run is an input of its own.
- After the run the window is put back (desktop, original size, opaque, dark, the vault's navigation
  setting); `runner.restore` checks it.

## 4. Integrated regression (`tests/integration/run-all.mjs`)

```sh
node tests/integration/run-all.mjs <new_out_dir> [--baseline-39 <runtime.json>] [--baseline-43 <runtime.json>]
```

Static tests and every negative self-test, the clean-room build, the kit build test, then per Electron a fresh
instance each for run 1, the self-test, run 2 and the custom-frame run, the kit's dry runs (phone and tablet
emulation), the comparisons with the baselines and the release judgement on this run's results. About 3 hours.
`<new_out_dir>` must not exist; nothing outside it and the isolated instances is touched. NOT MET of the
release is a result, not a failure; any FAIL or a missing result file is.

## 5. Quality and visual tools

| Command | What |
|---|---|
| `node tests/quality/important-audit.mjs --vault "$V" --out <f.json>` | Removes each allow-listed `!important` in turn and measures with the runtime tests' code (11E). About 15 min |
| `node tests/quality/contrast.mjs <runtime.json> <v38-compare-gray-active.csv> --out <f.json>` | WCAG ratios from measured colours (recorded only, Q-D15) |
| `node tests/visual/mermaid-pixels.mjs --vault "$V" --out <f.json> [--png <dir>]` | Mermaid: Obsidian's themed SVG and the reference drawn by the same renderer, compared pixel by pixel (11F), with controls that a shape fill, an SVG text fill and a filter on an HTML label are seen. About 2 min. It compares colours and painted properties only: the reference takes the geometry of Mermaid's random curves from Obsidian's diagram, so shapes are not checked independently |
| `... --restore-self-test` | Negative tests of the tool's own restore: every inline change it makes is undone by putting each element's style attribute back as it was, also after an error |
| `python3 -I tests/visual/self-test.py` | The region sampler's and V-30 comparison's negative tests |
| `CAPTURE_INKDROP=off bash tests/visual/capture-obsidian.sh ...` | A native capture that never hides or shows Inkdrop's window (without the variable it does, for V-38) |
| `node tests/visual/g5-capture.mjs --themes <dir> --out <new dir> --tmp <dir>` | Step 11G G5: the 8 native captures of the custom-frame title bar (2 builds x 2 themes x opaque / translucent), each with its regions (`g5-regions.js`) and records; takes the screen for about 2 minutes, so only with the user's go. Starts nothing, and restores nothing, unless the LaunchServices check is the known normal state (prints NOT STARTED, exit 5); prints SCREEN RELEASED only when its own instance is confirmed stopped, port 9333 closed and no backdrop of the run left; exit 0 complete, 1 captures incomplete, 3 screen not confirmed released, 4 LaunchServices not confirmed restored (restore and the check after must exit 0 and match the check before). `--plan` lists the captures and does nothing else |
| `python3 -I tests/visual/g5-judge.py <dir> --out <f.json> [--method v1\|v2]` | Judges those captures. v1 (the first G5 run): flat regions, CIEDE2000 <= 1.0 between the title bar and the left tab strip. v2 (research/14 §6.83, for the confirmatory run): the title bar against the centre tab strip directly below it over the same DOM-derived columns (window corner 9 pt and window buttons left out), tiles of at most 8 x 8 pt with sd <= 1.0 and no step > 1.0 between neighbours, CIEDE2000 <= 1.0; the pre-fix build must differ overall and in every column. `tests/visual/g5-self-test.py` holds the negative tests (in `npm test` and CI) |
| `python3 -I tests/visual/g5-overlay.py <capture dir> <new review dir>` | Review images of the v2 rectangles (`pair.titlebar`, `pair.tab` with their tiles; left tab strip for diagnosis) on each capture, for the visual check that is part of a v2 result (needs Pillow) |
| `node tests/visual/g5-capture.mjs ... --precheck` | Only the LaunchServices check against the known normal state (default handler `/Applications/Obsidian.app`, no E43 copy registered); run before the user is asked to stop working. Exit 0 a run may start, 5 not |
| `bash tests/visual/g6-packages.sh <new dir> <tmp>` | Step 11G G6 (V-35, research/14 §6.95): the Inkdrop theme packages Solarized Dark 2.2.1 and Kanagawa Dragon 1.2.1 at the commits of research/00, laid out for an isolated Inkdrop's `packages/` (public repositories only) |
| `bash tests/runtime/inkdrop-isolated.sh start\|stop <work>` | An isolated Inkdrop (`INKDROP_USER_DATA_PATH=<work>/user-data`, debugger on 127.0.0.1:9334; `G6_PACKAGES=<dir>` copies the theme packages into its `packages/`). A start counts only when the PID is alive, its page is on 9334 and 9334's listener is that PID; otherwise what it started is stopped again and the cleanup is confirmed like a stop (the PID and every helper it started gone, nothing on 9334, the user's Inkdrop PIDs unchanged: exit 1) or reported (exit 5, CLEANUP FAILED). Exit 3 when another Inkdrop holds the single-instance lock (nothing is signalled; the app in front before and after is recorded). Stop ends only the instance it started and succeeds only when it is gone, 9334 is closed and the user's Inkdrop PIDs are unchanged. The sign-in credentials are NOT isolated (macOS keychain, service `inkdrop`): never sign in or out in it. Only with the user's approval |
| `node tests/visual/g6-run.mjs isolation\|notes\|settings\|capture <work> ...` | Drives that instance. Every subcommand first checks the isolation (`g6-rules.mjs`, fail closed: started PID, 9334 listener, page PID, userData, config, packages and database location in the isolated directory, the database by an app path or an open file under `<data>/db`, no open file of the user's profile, the user's Inkdrop PIDs unchanged) and does nothing on a problem (exit 4) or on the sign-in screen (exit 6). `isolation` and `notes` write only to `<work>/private/<name>.json` (`<work>` outside the repository, iCloud and the user's Inkdrop profile, `private/` a real directory, the file new; anything else exit 7) and print counts only; `settings` line numbers, active line, acrylic; `capture` both themes x the V-35 states with native captures and probes (`g6-state.js`, `g6-probe.js`) |
| `python3 -I tests/visual/g6-judge.py <dir> --out <f.json>` | Judges the V-35 captures against V-22 / V-30: INVALID, PASS, DIFF (conditions equal), HOLD (a condition differs too), RECORD (states without an earlier value); the run is COMPLETE only with all 8 conditions once each and every image present with its recorded SHA-256. `tests/visual/g6-self-test.py` holds the negative tests (in `npm test` and CI) |
| `bash tests/runtime/inkdrop-production.sh prepare\|start\|restart\|restore <work>` | G6 method C (research/14 §6.105): the user's own Inkdrop. `prepare` records whether it runs, quits it normally (never a force quit), backs up `config.json` (a temporary copy confirmed by SHA-256 before it becomes the backup; a failure after the quit is reported as such and a quit Inkdrop is started again) and records `keymap.json`, `styles.css`, `init.js`, `packages/`, `state-cache/`, places missing theme packages; `start` / `restart` with the debugger on 127.0.0.1:9334 (a restart only after a confirmed quit); `restore` uses only this work dir's confirmed backup, checked again right before the write, and writes `config.json` back only once no Inkdrop process (main or helper) runs and 9334 is closed (no `quit` is sent when none runs; packages are placed through a partial directory renamed into place), takes out the placed packages, checks every recorded file and brings Inkdrop back to running or quit as before (exit 0 RESTORED, 5 otherwise). The database, sync state and `state-cache/` are not restored. Only with the user's approval of method C |
| `bash tests/visual/g6-c-run.sh <work> <out> <tmp>` | The whole method C run in one go (prepare, start, check, tutorial inventory, note identity, opaque captures, acrylic captures, note identity again); once `prepare` has made a backup, `restore` runs on every way out (trap on EXIT), and a note or document that changed stops the run at once. An existing `<work>` or `<out>` is refused before anything runs. After the captures `g6-judge.py` must say COMPLETE with no INVALID capture (its PASS / DIFF / HOLD / RECORD are kept as the judgement). Reports CAPTURE and RESTORE separately; exit 0 only with both. Only with the user's approval of method C and their go |

## 6. Device kit (`tests/device/`)

1. `node tests/device/build-kit.mjs <out_dir>` builds `InkdropThemeTest/` and its zip: the test vault, both built
   themes and a plugin of its own (`ink-device-check`, no network). `<out_dir>` must not be inside a vault; an
   existing kit is replaced only with `--replace` and only when unchanged.
2. On the device: unzip, open the folder as a vault of its own, turn off restricted mode, enable "Inkdrop theme
   device check", run "Run checks" (writes `device-results/results-*.json`) and "Screenshot tour".
3. On the Mac: `node tests/device/judge.mjs <results-*.json> --out <report.json> --label "<device, OS, app>"`.
4. With an iPhone on a cable: `node tests/device/cable.mjs <cdpPort> probe|reload|checks|tour|pull|shot` (needs
   pymobiledevice3, Web Inspector on, and the two bridges started as the file's header says). After replacing a
   kit on the device, `reload` (the old plugin stays in memory).

- **Phone and tablet**: every job names its device class. The plugin runs the phone jobs on a phone and the
  tablet jobs on a tablet (`Platform.isTablet`), the syntax and Mermaid jobs on both, and records which
  (`device` in the results and tour files). The tablet tour has no navigation-bar or keyboard steps. The judge
  fails `device.environment` when the kit ran another class's jobs; the release judgement rejects results on
  the wrong platform. Kits built before 11F ran the phone jobs only (on an iPad they cannot give a tablet
  result).
- **Safety marker**: `.obsidian/inkdrop-device-kit.json` holds a random kit id and the SHA-256 of every kit
  file. The plugin and the cable driver run nothing in a vault without that marker and id.
- **Kit hash changes**: the kit bundles the built themes, the fixture vault and the page scripts
  (`tests/runtime/probe.js`, `code-tokens.js`, `mermaid-dump.js`). Any change to them gives the next kit other
  hashes and a new kit id. A device report stays tied to the kit it was measured with: the approved iPhone
  results (step 10, research/evidence/phase3-step10/) are those of the old kit; a new kit is measured on the
  devices again before its results count (11G, with approval each time).
- **Drawer header** (`qd1.mobile-drawer-header`): each open-drawer step of the tour records where the drawer
  header and body show only their background (`tests/device/drawer-geometry.js`), at the start and at the end
  of the hold; `cable.mjs tour` reads the same right before and right after each drawer screenshot.
  `python3 -I tests/device/drawer-header.py --tour <tour-*.json> --shots <cable tour dir> --out <f.json>`
  requires the four drawer steps (both themes, left and right) exactly once, each with its image and four
  agreeing geometries, and samples the images there (8- or 16-bit PNG): both areas flat (sd <= 1.0) and the
  same colour (CIEDE2000 <= 1.0). `tests/device/drawer-header-self-test.py` holds its negative tests (in
  `npm test` and CI); the kit dry runs drive the real `cable.mjs tour` with a CDP screenshot stand-in and run
  the check end to end.
- No device: `node tests/device/kit-self-test.mjs build|plugin|dry-run|dry-run-tablet <new_work_dir>` (the
  dry runs drive the kit in an isolated instance with phone or tablet emulation; their `device.environment`
  checks FAIL by design, so a dry run is never accepted as a device run).

## 7. Known limits and how they show

| Limit | Shows as | Handling |
|---|---|---|
| Obsidian 1.14.4 reloads the vault config about 1.5 s after a change and can put the colour scheme back | the light-scheme Mermaid jobs measure dark | `setScheme` writes to disk at once and checks after the window, up to 3 times (research/14 §6.25) |
| The first DOM menu of a session ignores the pointer | `runner.pointer-prepared` FAIL on `menu-open` | one menu is opened and closed first |
| Mobile emulation reloads the window; the kit's plugin comes back disabled | dry run without results | the dry run enables it again |
| Translucency is composited by macOS | CDP screenshots do not show it | translucent looks are compared on native captures only (V-38); runtime checks read Computed Style |
| The syntax positive control once missed a Reading-view code block (E43, 11E; cause unknown) | `syn.self-test` FAIL "code element not rendered" | not retried: the result stays FAIL. The dump records what the page showed (`code-tokens.js`: languages drawn, scroll, sections, visibility, focus, and whether the block was there 1.5 s later); the full detail is in the result's `measured`. If it comes back, read that before running again |
| Mermaid draws some shapes with random curves; anti-aliasing of slanted edges varies between shots and places | pixel differences on edges | `mermaid-pixels.mjs` takes Obsidian's geometry into the reference and leaves out pixels that vary between shots of the same side (at most 2 %). Once (E43, 11F) 6 and 9 edge pixels of the large flowchart still differed with the values frozen: that run stays a FAIL; nothing is loosened (research/14 §6.54.1) |
| Scroll anchoring keeps content in place when something is inserted above | a shifted shot that did not move | `mermaid-pixels.mjs` turns it off in its own leaf |
| The cable screenshot takes about 2.5 s after the last check that Obsidian is in front | a notification in an image | every device image is looked at |

## 8. Putting things back

1. `bash tests/runtime/obsidian-isolated.sh stop "$W"` for every instance you started (`pgrep -fl user-data-dir`
   shows any left; stop only those whose `--user-data-dir` is yours).
2. After E43: `bash tests/runtime/current-installer.sh restore`, then `check`, and compare with the `check`
   taken before.
3. Work dirs are yours to delete; the tools delete nothing outside them.
