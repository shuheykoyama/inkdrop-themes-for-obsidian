// Step 11G G5 (research/14 §6.73): where to sample a native capture of the isolated Obsidian with the custom
// frame. Runs in the isolated window right after tests/visual/capture-obsidian.sh took the capture (same layout),
// with `window.__G5 = { inset, minWidth, minHeight, trafficLights }`. Reports, in window points (the page's CSS
// px; the custom frame has no native title bar above the page), the widest strip with nothing painted in it of
//   titlebar       .titlebar (macOS draws the window buttons over its left end: `trafficLights` points are
//                  left out as painted),
//   left-tabstrip  the left dock's tab header container (the note list acrylic, the reference),
//   root-tabstrip  the centre tab header container (recorded for reference),
// each inset by `inset`, with the element found at the strip's centre and the computed background of the
// three elements. Reports what it found, never a judgement (tests/visual/g5-judge.py checks it).
(async () => {
  const { inset = 4, minWidth = 20, minHeight = 10, trafficLights = 90 } = window.__G5 ?? {};
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
  // The widest free interval of [lo, hi] once the `used` intervals are taken out.
  const widest = (lo, hi, used) => {
    const cuts = used.map(([a, b]) => [Math.max(lo, a), Math.min(hi, b)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
    let best = null, at = lo;
    for (const [a, b] of [...cuts, [hi, hi]]) {
      if (a - at > (best ? best[1] - best[0] : 0)) best = [at, a];
      at = Math.max(at, b);
    }
    return best;
  };
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
  return {
    window: { innerWidth, innerHeight, devicePixelRatio, bounds: electronWindow.getBounds(), focused: electronWindow.isFocused() },
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
