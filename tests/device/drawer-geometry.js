// Drawer geometry for the qd1.mobile-drawer-header pixel check (research/14 §6.61). Runs on the device inside
// the kit's screenshot tour, and in the isolated Obsidian for tests, after `window.__DRAWER = { inset }`.
// For each open drawer it reports, in CSS pixels:
//   header     the rectangle of .workspace-drawer-header and its own painting (background, backdrop filter,
//              shadow): the header paints nothing of its own in the PoC, so the drawer shows through it;
//   headerArea the widest strip of the header with nothing painted in it (no text, icon, raised button,
//              border, shadow), inset by `inset` px;
//   bodyArea   the tallest band of the drawer's tab container with nothing painted in it, inset the same.
// tests/device/drawer-header.py samples the screenshot in these two areas (scaled by the screenshot's width
// over the viewport's) and compares them. Reports what it found, never a judgement.
(async () => {
  const { inset = 4 } = window.__DRAWER ?? {};
  const round = (v) => Math.round(v * 100) / 100;
  const box = (r) => [r.x, r.y, r.width, r.height].map(round);
  const shown = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (e.checkVisibility ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true); };
  const clear = (c) => !c || c === "transparent" || /rgba\([^)]*,\s*0\)$/.test(c) || /\/\s*0\)$/.test(c);
  // Rectangles inside `root` where something is painted: every line box of its text, svg / img / canvas, and
  // boxes with a background, border, shadow or backdrop filter. A painted box as large as half of `root` or more
  // is its own background (what is sampled) and is left out; a shadow is widened by 8 px.
  const painted = (root) => {
    const rr = root.getBoundingClientRect();
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent.trim() || !shown(n.parentElement)) continue;
      const range = document.createRange();
      range.selectNodeContents(n);
      for (const r of range.getClientRects()) if (r.width > 0 && r.height > 0) out.push([r.left, r.top, r.right, r.bottom]);
    }
    for (const e of root.querySelectorAll("*")) {
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect();
      if (e instanceof SVGElement || e.tagName === "IMG" || e.tagName === "CANVAS") { out.push([r.left, r.top, r.right, r.bottom]); continue; }
      const cs = getComputedStyle(e);
      const border = ["Top", "Right", "Bottom", "Left"].some((s) => parseFloat(cs[`border${s}Width`]) > 0 && !clear(cs[`border${s}Color`]));
      const shadow = cs.boxShadow && cs.boxShadow !== "none";
      const backdrop = (cs.backdropFilter || cs.webkitBackdropFilter || "none") !== "none";
      const fill = !clear(cs.backgroundColor) || (cs.backgroundImage && cs.backgroundImage !== "none");
      if (!(border || shadow || backdrop || fill) || r.width * r.height >= 0.5 * rr.width * rr.height) continue;
      const m = shadow ? 8 : 0;
      out.push([r.left - m, r.top - m, r.right + m, r.bottom + m]);
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
  const area = (x0, y0, x1, y1) => (x1 - x0 > 2 * inset && y1 - y0 > 2 * inset ? [x0 + inset, y0 + inset, x1 - x0 - 2 * inset, y1 - y0 - 2 * inset].map(round) : null);
  const out = { dpr: devicePixelRatio, viewport: [innerWidth, innerHeight], inset, drawers: [] };
  for (const d of document.querySelectorAll(".workspace-drawer")) {
    if (!shown(d)) continue;
    const dr = d.getBoundingClientRect();
    // A closed drawer is moved off the screen.
    if (dr.right <= 1 || dr.left >= innerWidth - 1) continue;
    const header = d.querySelector(".workspace-drawer-header");
    const body = d.querySelector(".workspace-drawer-active-tab-container");
    const rec = { side: d.classList.contains("mod-left") ? "left" : d.classList.contains("mod-right") ? "right" : "?", drawer: box(dr), header: null, headerArea: null, bodyArea: null };
    if (header && shown(header)) {
      const hr = header.getBoundingClientRect();
      const hcs = getComputedStyle(header);
      rec.header = { rect: box(hr), backgroundColor: hcs.backgroundColor, backdropFilter: hcs.backdropFilter || hcs.webkitBackdropFilter || "none", boxShadow: hcs.boxShadow };
      // Free columns of the header (its children's painted boxes cut it into strips).
      const used = painted(header).filter(([, y0, , y1]) => y1 > hr.top && y0 < hr.bottom).map(([x0, , x1]) => [x0, x1]);
      const cols = widest(Math.max(hr.left, 0), Math.min(hr.right, innerWidth), used);
      if (cols) rec.headerArea = area(cols[0], hr.top, cols[1], hr.bottom);
    }
    if (body && shown(body)) {
      const br = body.getBoundingClientRect();
      // Free rows of the tab container across its width (16 px in from each side).
      const x0 = Math.max(br.left, 0) + 16, x1 = Math.min(br.right, innerWidth) - 16;
      const used = painted(body).filter(([a, , b]) => b > x0 && a < x1).map(([, y0, , y1]) => [y0, y1]);
      const rows = widest(Math.max(br.top, 0), Math.min(br.bottom, innerHeight), used);
      if (rows) rec.bodyArea = area(x0, rows[0], x1, rows[1]);
    }
    out.drawers.push(rec);
  }
  return out;
})();
