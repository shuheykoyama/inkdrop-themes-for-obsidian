// Step 11G G6 (research/14 §6.95): read-only measurement of the isolated Inkdrop for one V-35 capture:
// computed styles of the active line, gutter, selection, search match and code block line, the order of the
// CodeMirror layers, versions, settings, window state and the shown note's identity (never its body).
(async () => {
  const tryGet = (f) => { try { return f() ?? null; } catch { return null; } };
  const style = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return { selector: sel, found: false };
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return { selector: sel, found: true, rect: [r.x, r.y, r.width, r.height].map(Math.round), classes: [...el.classList],
      backgroundColor: cs.backgroundColor, color: cs.color, zIndex: cs.zIndex,
      borderRight: `${cs.borderRightWidth} ${cs.borderRightStyle} ${cs.borderRightColor}` };
  };
  const scroller = document.querySelector(".cm-scroller");
  const note = inkdrop.store.getState().editingNote;
  const doc = note ? await inkdrop.localDB.notes.get(note._id).catch(() => null) : null;
  const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const pkg = (n) => tryGet(() => inkdrop.packages.getLoadedPackage(n).metadata.version);
  const theme = inkdrop.config.get("core.theme");
  return {
    measuredAt: new Date().toISOString(),
    inkdropVersion: inkdrop.appVersion ?? null, theme, themeVersion: pkg(theme),
    settings: { lineNumbers: inkdrop.config.get("editor.lineNumbers"), styleActiveLine: inkdrop.config.get("editor.styleActiveLine"), acrylic: inkdrop.config.get("core.mainWindow.acrylicEnabled") },
    bodyClasses: [...document.body.classList],
    window: { viewport: [innerWidth, innerHeight], devicePixelRatio, screen: [screenX, screenY, outerWidth, outerHeight], focused: document.hasFocus() && !document.body.classList.contains("is-blurred") },
    styles: Object.fromEntries([
      ["activeLine", ".cm-activeLine"], ["activeLineGutter", ".cm-activeLineGutter"], ["gutters", ".cm-gutters"],
      ["lineNumber", ".cm-lineNumbers .cm-gutterElement:not(.cm-activeLineGutter)"], ["selection", ".cm-selectionBackground"],
      ["searchMatch", ".cm-searchMatch"], ["searchMatchSelected", ".cm-searchMatch-selected"], ["editor", ".cm-editor"],
    ].map(([k, s]) => [k, style(s)])),
    // The CodeMirror layers in paint order (DOM order inside the scroller, with their z-index).
    layers: scroller ? [...scroller.children].map((c) => ({ classes: [...c.classList], zIndex: getComputedStyle(c).zIndex })) : null,
    note: doc ? { _id: doc._id, _rev: doc._rev, updatedAt: doc.updatedAt, bodySha256: await sha(doc.body ?? "") } : null,
  };
})();
