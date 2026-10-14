// Fold preparation as the probe does it, repeated: open "Editor chrome" in source mode, unfold all, cursor on
// "## Folded", toggle fold; log the placeholder and Obsidian's own fold info over time after each step.
import { evaluate } from "../../../../../tests/runtime/lib/cdp.mjs";
const n = Number(process.argv[2] ?? 8);
const rows = [];
for (let i = 0; i < n; i++) {
  rows.push(await evaluate(9333, `(async () => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ws = app.workspace;
    const leaf = ws.getMostRecentLeaf();
    app.vault.setConfig("showLineNumber", true);
    await leaf.setViewState({ type: "markdown", state: { file: "Editor chrome.md", mode: "source", source: true }, active: true });
    ws.setActiveLeaf(leaf, { focus: true });
    const ph = () => leaf.view.contentEl.querySelectorAll(".cm-foldPlaceholder").length;
    const info = () => JSON.stringify(leaf.view.currentMode?.getFoldInfo?.() ?? null);
    const log = [["opened", ph(), info()]];
    await sleep(1500); log.push(["after 1.5 s", ph(), info()]);
    const ed = leaf.view.editor; ed.focus();
    app.commands.executeCommandById("editor:unfold-all"); await sleep(300); log.push(["unfold-all", ph(), info()]);
    const line = ed.getValue().split("\\n").findIndex((l) => l.includes("## Folded"));
    ed.setCursor({ line, ch: 1 });
    const ok = app.commands.executeCommandById("editor:toggle-fold");
    for (const t of [100, 400, 1000, 2500]) { await sleep(t); log.push(["toggle +" + t, ph(), info()]); }
    log.push(["cursor", JSON.stringify(ed.getCursor()), document.activeElement?.className?.toString().slice(0, 30), ok, "docFocus", document.hasFocus(), "edFocus", ed.hasFocus(), "winFocused", electronWindow.isFocused()]);
    // leave as the probe's restore does: unfold all, back to Sample note
    app.commands.executeCommandById("editor:unfold-all"); await sleep(300); log.push(["restore unfold", ph(), info()]);
    await leaf.setViewState({ type: "markdown", state: { file: "Sample note.md", mode: "source", source: false }, active: true });
    await sleep(500);
    return log;
  })()`, 120000));
}
for (const [i, r] of rows.entries()) console.log(i, JSON.stringify(r));
