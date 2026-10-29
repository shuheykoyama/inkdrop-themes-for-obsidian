// Loading and validation of the test specifications (research/14 §3.3):
//   tests/spec/requirements.json   required visual roles of the confirmed Q-D decisions
//   tests/spec/runtime/*.json      runtime checks (each names one requirement)
// Shared by the static tests (S6) and the runtime runner, so a malformed spec fails in both places.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DOCUMENTS = ["main", "settings"];
const APPEARANCES = ["opaque", "translucent"];
const EXPECTS = ["match", "absent", "hidden"];
// desktop = the real macOS app; the others are app.emulateMobile(true) on desktop (PASS (EMULATED)).
export const THEMES = ["solarized-dark", "kanagawa-dragon"];
export const PLATFORMS = ["desktop", "tablet", "phone", "phone-nonfloating"];
// Probe states: desktop "default" has both docks expanded and two notes open in the centre (the other one
// is an inactive tab); "user-accent" sets an accent colour in the test vault's settings for the measurement;
// "quick-switcher-open" opens the quick switcher (an in-window modal); "fullscreen-class" adds the
// is-fullscreen class to body for the measurement (simulates only the class Obsidian sets in full screen);
// on mobile "default" has both drawers closed.
// "self-test-translucent-leak" turns translucency on in a mobile probe: allowed only in the runner's own
// negative spec, to prove that an opaque mobile check refuses a translucent window. Likewise the other
// "self-test-*" states take a prepared state away on purpose (step 10 re-review, research/14 §6.25):
// "self-test-ed-gutter-lost" (the line-number setting reverted in memory), "self-test-fold-lost" (the fold
// opened again), "self-test-settings-search" (text in the settings search hides the tab list),
// "self-test-pointer-missed" (the pointer hovers where no link preview opens). Three change Settings > About
// around the Help row that ui.button.background measures (research/14 §6.139): "self-test-settings-decoys"
// (a hidden and a red button row before the general rows), "self-test-settings-help-displaced" (a button row
// between Language and Help), "self-test-settings-help-gone" (Help's button removed).
// Step 5: "file-explorer-focused" (the File Explorer leaf is the active one), "user-font" (an interface font in
// the test vault's settings), and three states the runner opens with a real pointer through CDP:
// "menu-open" (right-click a file, pointer on the first item; DOM menus), "popover-open" (Cmd + hover on an
// internal link), "tooltip-open" (hover on a ribbon button).
// Step 6: "md-source", "md-live", "md-reading" open tests/fixtures/vault/Markdown elements.md in the active
// centre leaf in Source mode, Live Preview or Reading view; "md-user-fonts" is Live Preview with a text and a
// monospace font in the test vault's settings.
// Step 7: "ed-*" open tests/fixtures/vault/Editor chrome.md with the test vault's line numbers on (off for
// "-no-lines"), the cursor on a line and one action (selection, search, fold);
// "ed-suggest" has the runner type "[[" through CDP so that Obsidian opens its suggestions.
export const STATES = ["default", "user-accent", "user-font", "quick-switcher-open", "fullscreen-class", "file-explorer-focused",
  "menu-open", "popover-open", "tooltip-open", "md-source", "md-live", "md-reading", "md-user-fonts",
  "ed-source", "ed-live", "ed-source-no-lines", "ed-live-no-lines", "ed-code-line", "ed-widget-line", "ed-selection",
  "ed-search", "ed-fold", "ed-suggest",
  "left-drawer-open", "right-drawer-open", "self-test-translucent-leak",
  "self-test-ed-gutter-lost", "self-test-fold-lost", "self-test-settings-search", "self-test-pointer-missed",
  "self-test-settings-decoys", "self-test-settings-help-displaced", "self-test-settings-help-gone"];
export const POINTER_STATES = ["menu-open", "popover-open", "tooltip-open", "ed-suggest", "self-test-pointer-missed"];
// color: a computed colour property; text: exact string (e.g. --accent-h); first-color: the first rgb()/rgba()
// in the value (e.g. the colour of a box-shadow); var: a custom property whose computed value is a colour
// (checks a variable where no visible element uses it in the test, e.g. hover-only colours).
// first-family: the first family name of a font-family value, quotes removed.
// em: a length of `value` em, against the element's computed font size.
// mixWhite / alpha (colour kinds): the expected colour mixed with white, then made translucent, as app.css
// derives mobile surfaces from the theme's colours.
const KINDS = ["color", "text", "first-color", "var", "first-family", "em"];

export function loadRequirements(specDir) {
  return JSON.parse(readFileSync(path.join(specDir, "requirements.json"), "utf8")).requirements;
}

export function loadChecks(files) {
  return files.flatMap((f) => JSON.parse(readFileSync(f, "utf8")).checks.map((c) => ({ ...c, _file: path.basename(f) })));
}

export const runtimeSpecFiles = (specDir) =>
  readdirSync(path.join(specDir, "runtime")).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(specDir, "runtime", f));

// Structural errors of one check (empty array = valid). `requirementIds` may be null (self-test specs).
export function checkErrors(c, requirementIds) {
  const e = [];
  const where = c.id ?? "(no id)";
  for (const k of ["id", "selector", "property"]) if (typeof c[k] !== "string" || !c[k]) e.push(`${where}: missing ${k}`);
  if (!DOCUMENTS.includes(c.document)) e.push(`${where}: document must be one of ${DOCUMENTS.join("/")}`);
  if (!Array.isArray(c.appearance) || !c.appearance.length || c.appearance.some((a) => !APPEARANCES.includes(a))) e.push(`${where}: appearance must list ${APPEARANCES.join("/")}`);
  const platforms = c.platform ?? ["desktop"];
  if (!Array.isArray(platforms) || !platforms.length || platforms.some((p) => !PLATFORMS.includes(p))) e.push(`${where}: platform must list ${PLATFORMS.join("/")}`);
  if (c.appearance?.includes("translucent") && platforms.some((p) => p !== "desktop")) e.push(`${where}: translucent exists on desktop (macOS) only`);
  if (!STATES.includes(c.state ?? "default")) e.push(`${where}: state must be one of ${STATES.join("/")}`);
  if (requirementIds && String(c.state).startsWith("self-test-")) e.push(`${where}: state ${c.state} is for the runner's self-test only`);
  if (c.scrollTo !== undefined && !(typeof c.scrollTo === "string" && c.scrollTo && String(c.state).startsWith("md-"))) e.push(`${where}: scrollTo is a non-empty line text and needs an md-* state`);
  if (c.pseudo !== undefined && !["::before", "::after", "::marker", "::selection"].includes(c.pseudo)) e.push(`${where}: pseudo must be ::before, ::after, ::marker or ::selection`);
  // frame: the window frame the check needs (Settings > Appearance > Window frame style); default Hidden, the
  // macOS default. A check for another frame runs in an instance started with that frame (desktop only).
  if (c.frame !== undefined && !(["hidden", "custom", "native"].includes(c.frame) && platforms.every((p) => p === "desktop"))) e.push(`${where}: frame must be hidden, custom or native, on desktop only`);
  if (c.themes !== undefined && !(Array.isArray(c.themes) && c.themes.length && c.themes.every((t) => THEMES.includes(t)))) e.push(`${where}: themes must list ${THEMES.join("/")}`);
  if (!KINDS.includes(c.kind ?? "color")) e.push(`${where}: kind must be one of ${KINDS.join("/")}`);
  if (c.kind === "em" && !(typeof c.value === "string" && Number(c.value) > 0)) e.push(`${where}: kind em needs a positive value`);
  for (const k of ["mixWhite", "alpha"]) if (c[k] !== undefined && !(typeof c[k] === "number" && c[k] >= 0 && c[k] <= 1 && ["color", "first-color", "var"].includes(c.kind ?? "color"))) e.push(`${where}: ${k} is a number 0-1 on a colour kind`);
  const expect = c.expect ?? "match";
  if (!EXPECTS.includes(expect)) e.push(`${where}: expect must be one of ${EXPECTS.join("/")}`);
  if (expect === "match" && !(typeof c.token === "string") === !(typeof c.value === "string")) e.push(`${where}: expect match needs exactly one of token / value`);
  // An expected absence or hidden state must say why; otherwise a missing element could be "expected" by accident.
  if (expect !== "match" && !(typeof c.reason === "string" && c.reason.trim())) e.push(`${where}: expect ${expect} needs a reason`);
  if (requirementIds && !requirementIds.has(c.requirement)) e.push(`${where}: unknown requirement ${c.requirement}`);
  return e;
}

// S6: every requirement is covered by at least one check, or is UNVERIFIED with reason and risk (not both).
export function requirementErrors(requirements, checks) {
  const e = [];
  const ids = new Set();
  for (const r of requirements) {
    if (ids.has(r.id)) e.push(`${r.id}: duplicate requirement id`);
    ids.add(r.id);
    for (const k of ["id", "qd", "description"]) if (typeof r[k] !== "string" || !r[k]) e.push(`${r.id}: missing ${k}`);
    if (typeof r.mandatory !== "boolean") e.push(`${r.id}: mandatory must be true or false`);
    if (!Array.isArray(r.platforms) || !r.platforms.length) e.push(`${r.id}: platforms must be a non-empty list`);
    // Coverage: a runtime check names the requirement, or `verifiedBy` records a verification that is not a
    // runtime check (a native-capture comparison, a manual measurement), each with method, evidence and result.
    const vb = r.verifiedBy;
    if (vb !== undefined && (!Array.isArray(vb) || !vb.length || vb.some((v) => !["method", "evidence", "result"].every((k) => typeof v?.[k] === "string" && v[k].trim()))))
      e.push(`${r.id}: verifiedBy needs method, evidence and result for every entry`);
    // A scope says where a recorded verification was made; the release judgement (tests/release/gate.mjs)
    // counts it only there.
    for (const v of Array.isArray(vb) ? vb : []) {
      const s = v?.scope;
      if (s === undefined) continue;
      if (!["macOS", "iOS", "Android", "Windows", "Linux"].includes(s?.os) || !["desktop", "phone", "tablet"].includes(s?.device)
        || !Array.isArray(s?.themes) || !s.themes.length || s.themes.some((t) => !THEMES.includes(t)) || !/^\d+\.\d+\.\d+$/.test(s?.appVersion ?? ""))
        e.push(`${r.id}: verifiedBy scope needs os, device, themes (${THEMES.join(" / ")}) and appVersion x.y.z`);
      // The outcome of a scoped record is explicit; the free text of `result` is never read as a PASS.
      if (!["PASS", "FAIL", "UNVERIFIED"].includes(v.status)) e.push(`${r.id}: a verifiedBy entry with a scope needs status PASS / FAIL / UNVERIFIED`);
    }
    // accepts: a state other than PASS that counts for the release, with the decision it rests on.
    if (r.accepts !== undefined && (typeof r.accepts !== "object" || !Object.keys(r.accepts).length || Object.entries(r.accepts).some(([k, v]) => !["DIFF", "UNSUPPORTED"].includes(k) || typeof v !== "string" || !v.trim())))
      e.push(`${r.id}: accepts may only name DIFF / UNSUPPORTED, each with the decision it rests on`);
    const covered = checks.some((c) => c.requirement === r.id) || (Array.isArray(vb) && vb.length > 0);
    const unverified = r.unverified && typeof r.unverified.reason === "string" && r.unverified.reason.trim() && typeof r.unverified.risk === "string" && r.unverified.risk.trim();
    if (r.unverified && !unverified) e.push(`${r.id}: unverified needs both reason and risk`);
    if (!covered && !unverified) e.push(`${r.id}: no check and no UNVERIFIED record (reason + risk)`);
    if (covered && r.unverified) e.push(`${r.id}: has checks but is still marked unverified`);
  }
  const checkIds = new Set();
  for (const c of checks) {
    if (checkIds.has(c.id)) e.push(`${c.id}: duplicate check id`);
    checkIds.add(c.id);
  }
  return e;
}
