// Self-test of g4.mjs (research/14 §6.152) without Obsidian or a real full screen: a fake <repo> whose
// tests/runtime/lib/cdp.mjs runs g4.mjs's page expressions against a fake window (node:vm), driven by G4_FAKE.
// Each case runs g4.mjs as a child process and checks its exit status and what it stored.
//
// usage: node g4-self-test.mjs   (exit 0 when every case behaves as declared)
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const G4 = path.join(import.meta.dirname, "g4.mjs");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "g4-self-test-"));
const repo = path.join(tmp, "repo");
for (const t of ["solarized-dark", "kanagawa-dragon"]) {
  fs.mkdirSync(path.join(repo, "dist", t), { recursive: true });
  fs.writeFileSync(path.join(repo, "dist", t, "theme.css"), `/* ${t} */ body { color: red; }\n`);
}
fs.mkdirSync(path.join(repo, "tests/runtime/lib"), { recursive: true });
fs.writeFileSync(path.join(repo, "tests/runtime/lib/cdp.mjs"), String.raw`
import fs from "node:fs";
import vm from "node:vm";
const S = JSON.parse(process.env.G4_FAKE);
const log = (x) => fs.appendFileSync(S.log, x + "\n");
const classes = new Set(["is-focused"]);
let full = false, dead = false;
const styleEl = { textContent: "" };
const themeFile = (n) => S.vault + "/.obsidian/themes/" + n + "/theme.css";
const customCss = {
  theme: "", styleEl,
  async readThemes() {},
  setTheme(n) { this.theme = n; },
  async loadTheme() { styleEl.textContent = S.loadedText ?? fs.readFileSync(themeFile(this.theme), "utf8"); },
  setTranslucency(v) { v ? classes.add("is-translucent") : classes.delete("is-translucent"); },
};
// A full-screen run starts from a prepared window: the theme loaded, translucent on.
if (S.preloaded) { customCss.theme = S.preloaded; styleEl.textContent = fs.readFileSync(themeFile(S.preloaded), "utf8"); classes.add("is-translucent"); }
const app = { customCss, workspace: { layoutReady: true, leftSplit: { expand() {} }, rightSplit: { expand() {} }, getLeavesOfType: () => [], revealLeaf() {} } };
const electronWindow = {
  isFullScreen: () => full,
  setFullScreen(v) {
    log("setFullScreen " + v);
    if (v ? S.enter === false : S.exit === false) return;
    full = v;
    v ? classes.add("is-fullscreen") : classes.delete("is-fullscreen");
    if (v && S.dieAfterEnter) dead = true;
  },
};
const ctx = vm.createContext({
  app, electronWindow, crypto: globalThis.crypto, TextEncoder, Promise, setTimeout,
  navigator: { userAgent: "Electron/43.8.3" },
  window: { app, require: () => ({ ipcRenderer: { sendSync: (k) => (k === "version" ? "1.14.5" : "") } }) },
  document: { body: { classList: { contains: (c) => classes.has(c), [Symbol.iterator]: () => classes.values() } }, querySelector: () => ({}) },
  getComputedStyle: () => {
    if (full && S.failReadInFull) throw new Error("read failed in full screen");
    return { backgroundColor: full ? "rgb(0, 0, 0)" : classes.has("is-translucent") ? "rgba(0, 0, 0, 0.5)" : "rgb(0, 0, 0)" };
  },
});
export async function evaluate(port, expression) {
  if (dead) throw new Error("connection closed");
  return await vm.runInContext(expression, ctx);
}
export async function holdFocus() { return () => {}; }
`);
const spacesFake = path.join(tmp, "spaces.sh");
fs.writeFileSync(spacesFake, `printf '{"0": 5}\\n'\n`);

let n = 0, failed = 0;
const run = (name, { phase, theme, out, fake = {}, expectExit, check }) => {
  n++;
  const vault = path.join(tmp, `vault-${n}`);
  if (fake.preloaded) {
    const t = fake.preloaded.replace("G4 ", "");
    fs.mkdirSync(path.join(vault, ".obsidian/themes", fake.preloaded), { recursive: true });
    fs.copyFileSync(path.join(repo, "dist", t, "theme.css"), path.join(vault, ".obsidian/themes", fake.preloaded, "theme.css"));
  }
  const log = path.join(tmp, `log-${n}.txt`);
  fs.writeFileSync(log, "");
  const p = spawnSync(process.execPath, [G4, repo, vault, out, phase, theme], {
    encoding: "utf8",
    env: { ...process.env, G4_FAKE: JSON.stringify({ ...fake, vault, log }), G4_SPACES: spacesFake, G4_TIME_SCALE: "0.001" },
  });
  const stored = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, "utf8")) : null;
  const calls = fs.readFileSync(log, "utf8").trim().split("\n").filter(Boolean);
  let why = p.status !== expectExit ? `exit ${p.status}, declared ${expectExit}: ${p.stderr.trim().split("\n").at(-1)}` : check?.(stored, calls);
  if (why) failed++;
  console.log(`${why ? "FAIL" : "PASS"} g4 self-test: ${name}${why ? ` -- ${why}` : ""}`);
};
const file = (k) => path.join(tmp, `${k}.json`);
// A prepared file for kanagawa-dragon, as prep writes it (copied for each full-screen case).
const prepared = (k, theme = "kanagawa-dragon") => { fs.copyFileSync(file(`prep-${theme}`), file(k)); return file(k); };
const pre = { preloaded: "G4 kanagawa-dragon" };

run("prep kanagawa-dragon: the theme is installed and checked (name, length, SHA-256)", { phase: "prep", theme: "kanagawa-dragon", out: file("prep-kanagawa-dragon"), expectExit: 0,
  check: (r) => (r.theme === "kanagawa-dragon" && r.loadedTheme.theme === "G4 kanagawa-dragon" && r.loadedTheme.sha256 === r.cssSha256 && r.opaque && r.translucentBefore?.classes.includes("is-translucent") ? null : JSON.stringify(r)) });
run("prep solarized-dark", { phase: "prep", theme: "solarized-dark", out: file("prep-solarized-dark"), expectExit: 0,
  check: (r) => (r.loadedTheme.theme === "G4 solarized-dark" && r.loadedTheme.sha256 === r.cssSha256 ? null : JSON.stringify(r.loadedTheme)) });
run("prep refuses a theme that does not exist", { phase: "prep", theme: "solarized-light", out: file("bad-theme"), expectExit: 2, check: (r) => (r ? "wrote a file" : null) });
run("prep fails when the loaded text is not the built file", { phase: "prep", theme: "kanagawa-dragon", out: file("bad-load"), fake: { loadedText: "/* something else */" }, expectExit: 1,
  check: (r) => (r.opaque || r.translucentBefore ? "read the surfaces anyway" : null) });
run("full, normal: COMPLETE with during and after", { phase: "full", theme: "kanagawa-dragon", out: prepared("ok"), fake: pre, expectExit: 0,
  check: (r, c) => (r.status === "COMPLETE" && r.during.isFullScreen && r.during.classes.includes("is-fullscreen") && !r.after.isFullScreen && r.spacesAfterExit["0"] === 5 && !r.failedRun && c.join() === "setFullScreen true,setFullScreen false" ? null : JSON.stringify({ r, c })) });
run("full, a read fails in full screen: leaves, ABORTED, nothing stored as during/after", { phase: "full", theme: "kanagawa-dragon", out: prepared("read-fails"), fake: { ...pre, failReadInFull: true }, expectExit: 1,
  check: (r, c) => (r.status === "ABORTED" && !r.during && !r.after && r.failedRun.leftFullScreen && r.failedRun.stateAfterExit.isFullScreen === false && /read failed/.test(r.failedRun.error) && c.at(-1) === "setFullScreen false" ? null : JSON.stringify({ r, c })) });
run("full, never enters: still asks to leave, ABORTED", { phase: "full", theme: "kanagawa-dragon", out: prepared("no-enter"), fake: { ...pre, enter: false }, expectExit: 1,
  check: (r, c) => (r.status === "ABORTED" && r.failedRun.enteredFullScreen === false && c.at(-1) === "setFullScreen false" ? null : JSON.stringify({ r, c })) });
run("full, cannot leave: STUCK, exit 3", { phase: "full", theme: "kanagawa-dragon", out: prepared("no-exit"), fake: { ...pre, exit: false }, expectExit: 3,
  check: (r) => (r.status === "STUCK" && r.failedRun.leftFullScreen === false && r.failedRun.stateAfterExit.isFullScreen === true && !r.during ? null : JSON.stringify(r)) });
run("full, the connection dies in full screen: STUCK, exit 3", { phase: "full", theme: "kanagawa-dragon", out: prepared("dead"), fake: { ...pre, dieAfterEnter: true }, expectExit: 3,
  check: (r) => (r.status === "STUCK" && r.failedRun.stateAfterExit.error && !r.during ? null : JSON.stringify(r)) });
run("full refuses a file prepared for the other theme (no full screen asked)", { phase: "full", theme: "kanagawa-dragon", out: prepared("other", "solarized-dark"), fake: pre, expectExit: 1,
  check: (r, c) => (c.length || r.status ? `calls ${c}, status ${r.status}` : null) });
run("full refuses when the loaded theme changed since prep", { phase: "full", theme: "kanagawa-dragon", out: prepared("changed"), fake: { preloaded: "G4 solarized-dark" }, expectExit: 1,
  check: (r, c) => (c.length || r.status ? `calls ${c}, status ${r.status}` : null) });
run("full refuses a file that already holds a run", { phase: "full", theme: "kanagawa-dragon", out: file("ok"), fake: pre, expectExit: 1,
  check: (r, c) => (c.length || r.status !== "COMPLETE" ? `calls ${c}, status ${r.status}` : null) });

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} of ${n} g4 self-test cases FAILED` : `\nall ${n} g4 self-test cases behaved as expected`);
process.exit(failed ? 1 : 0);
