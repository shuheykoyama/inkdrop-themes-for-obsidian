// Step 11G G5 (research/14 §6.73): where to sample a native capture of the isolated Obsidian with the custom
// frame. Runs in the isolated window right after tests/visual/capture-obsidian.sh took the capture (same layout),
// with `window.__G5 = { inset, minWidth, minHeight, trafficLights }`. Reports, in window points (the page's CSS
// px; the custom frame has no native title bar above the page), the widest strip with nothing painted in it of
//   titlebar       .titlebar (macOS draws the window buttons over its left end: `trafficLights` points are
//                  left out as painted),
//   left-tabstrip  the left dock's tab header container (the note list acrylic, the reference),
//   root-tabstrip  the centre tab header container (recorded for reference),
// each inset by `inset`, with the element found at the strip's centre and the computed background of the
// three elements (method v1), and the pair of method v2 (research/14 §6.83): the columns where both the title bar
// (without the window buttons at the left end and the window's rounded corner, `corner` points at the right end
// of the window) and the centre tab strip directly below it have nothing painted, the widest such common range,
// and the title bar and tab strip bands over exactly those columns, each inset by `inset`. Reports what it found,
// never a judgement (tests/visual/g5-judge.py checks it).
(async () => {
  const { inset = 4, minWidth = 20, minHeight = 10, trafficLights = 90, corner = 9, minCommon = 32 } = window.__G5 ?? {};
  const round = (v) => Math.round(v * 100) / 100;
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.checkVisibility ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true); };
  const clear = (c) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c);
  // Rectangles inside `root` where something is painted: every line box of its text, svg / img / canvas, and
  // boxes with a background, border, shadow or backdrop filter smaller than half of `root` (larger ones are
  // its own background, which is what is sampled); a shadow is widened by 8 px.
  const painted = (root) => {
    const rr = root.getBoundingClientRect();
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !shown(n.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push([r.left, r.right]);
    }
    for (const e of root.querySelectorAll("*")) {
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      if (e instanceof SVGElement || e.tagName === "IMG" || e.tagName === "CANVAS") { out.push([r.left, r.right]); continue; }
      const cs = getComputedStyle(e);
      const border = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && !clear(cs[`border${s}Color`]));
      const shadow = cs.boxShadow && cs.boxShadow !== "none";
      const backdrop = (cs.backdropFilter || "none") !== "none";
      const fill = !clear(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== "none");
      if (!(border || shadow || backdrop || fill) || r.width * r.height >= 0.5 * rr.width * rr.height) continue;
      const m = shadow ? 8 : 0;
      out.push([r.left - m, r.right + m]);
    }
    return out;
  };
  // The free intervals of [lo, hi] once the `used` intervals are taken out, and the widest of them.
  const free = (lo, hi, used) => {
    const cuts = used.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    const out = [];
    let at = lo;
    for (const [a, b] of [...cuts, [hi, hi]]) {
      if (a > at) out.push([at, a]);
      at = Math.max(at, b);
    }
    return out;
  };
  const widest = (lo, hi, used) => free(lo, hi, used).reduce((best, iv) => (!best || iv[1] - iv[0] > best[1] - best[0] ? iv : best), null);
  const region = (selector, extraUsed = []) => {
    const e = document.querySelector(selector);
    if (!e || !shown(e)) return { selector, missing: true };
    const r = e.getBoundingClientRect();
    const cols = widest(Math.max(r.left, 0), Math.min(r.right, innerWidth), [...painted(e), ...extraUsed]);
    const rect = cols && cols[1] - cols[0] > 2 * inset && r.height > 2 * inset ? [cols[0] + inset, r.top + inset, cols[1] - cols[0] - 2 * inset, r.height - 2 * inset].map(round) : null;
    const big = !!rect && rect[2] >= minWidth && rect[3] >= minHeight;
    const centre = rect ? document.elementFromPoint(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2) : null;
    return { selector, element: [r.left, r.top, r.width, r.height].map(round), rect, bigEnough: big,
      background: getComputedStyle(e).backgroundColor,
      // The element under the strip's centre must be the element itself or a part of it that paints nothing.
      centre: centre ? { tag: centre.tagName.toLowerCase(), cls: String(centre.className).slice(0, 80), inside: e.contains(centre), background: getComputedStyle(centre).backgroundColor } : null };
  };
  // Method v2: the common free columns of the title bar and the centre tab strip.
  const pair = (() => {
    const tb = document.querySelector(".titlebar");
    const tab = document.querySelector(".workspace-split.mod-root .workspace-tab-header-container");
    if (!tb || !tab || !shown(tb) || !shown(tab)) return { missing: true };
    const tr = tb.getBoundingClientRect(), br = tab.getBoundingClientRect();
    const a = free(Math.max(tr.left, 0), Math.min(tr.right, innerWidth), [...painted(tb), [0, trafficLights], [innerWidth - corner, innerWidth]]);
    const b = free(Math.max(br.left, 0), Math.min(br.right, innerWidth), painted(tab));
    let best = null;
    for (const [a0, a1] of a) for (const [b0, b1] of b) {
      const lo = Math.max(a0, b0) + inset, hi = Math.min(a1, b1) - inset;
      if (hi > lo && (!best || hi - lo > best[1] - best[0])) best = [lo, hi];
    }
    if (!best) return { columns: null, bigEnough: false };
    const band = (r) => [best[0], r.top + inset, best[1] - best[0], r.height - 2 * inset].map(round);
    const centre = (rect) => { const e = document.elementFromPoint(rect[0] + rect[2] / 2, rect[1] + rect[3] / 2); return e ? { tag: e.tagName.toLowerCase(), inside: (rect === tbRect ? tb : tab).contains(e) } : null; };
    const tbRect = band(tr), tabRect = band(br);
    return { columns: best.map(round), width: round(best[1] - best[0]), bigEnough: best[1] - best[0] >= minCommon && tr.height - 2 * inset >= 8 && br.height - 2 * inset >= 8,
      titlebar: tbRect, tab: tabRect, titlebarCentre: centre(tbRect), tabCentre: centre(tabRect), corner, trafficLights, minCommon };
  })();
  return {
    window: { innerWidth, innerHeight, devicePixelRatio, bounds: electronWindow.getBounds(), focused: electronWindow.isFocused() },
    pair,
    frame: window.require("electron").ipcRenderer.sendSync("frame") || "hidden",
    classes: [...document.body.classList].filter((c) => /^is-(translucent|focused|fullscreen|frameless|hidden-frameless)$/.test(c)),
    theme: app.customCss.theme,
    regions: {
      titlebar: region(".titlebar", [[0, trafficLights]]),
      "left-tabstrip": region(".workspace-split.mod-left-split .workspace-tab-header-container"),
      "root-tabstrip": region(".workspace-split.mod-root .workspace-tab-header-container"),
    },
  };
})();
