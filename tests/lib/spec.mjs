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
export const PLATFORMS = ["desktop", "tablet", "phone", "phone-nonfloating"];
// Probe states: desktop "default" has both docks expanded and two notes open in the centre (the other one
// is an inactive tab); "user-accent" sets an accent colour in the test vault's settings for the measurement;
// "quick-switcher-open" opens the quick switcher (an in-window modal); "fullscreen-class" adds the
// is-fullscreen class to body for the measurement (simulates only the class Obsidian sets in full screen);
// on mobile "default" has both drawers closed.
// "self-test-translucent-leak" turns translucency on in a mobile probe: allowed only in the runner's own
// negative spec, to prove that an opaque mobile check refuses a translucent window.
// Step 5: "file-explorer-focused" (the File Explorer leaf is the active one), "user-font" (an interface font in
// the test vault's settings), and three states the runner opens with a real pointer through CDP:
// "menu-open" (right-click a file, pointer on the first item; DOM menus), "popover-open" (Cmd + hover on an
// internal link), "tooltip-open" (hover on a ribbon button).
export const STATES = ["default", "user-accent", "user-font", "quick-switcher-open", "fullscreen-class", "file-explorer-focused",
  "menu-open", "popover-open", "tooltip-open", "left-drawer-open", "right-drawer-open", "self-test-translucent-leak"];
export const POINTER_STATES = ["menu-open", "popover-open", "tooltip-open"];
// color: a computed colour property; text: exact string (e.g. --accent-h); first-color: the first rgb()/rgba()
// in the value (e.g. the colour of a box-shadow); var: a custom property whose computed value is a colour
// (checks a variable where no visible element uses it in the test, e.g. hover-only colours).
// first-family: the first family name of a font-family value, quotes removed.
const KINDS = ["color", "text", "first-color", "var", "first-family"];

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
  if (requirementIds && c.state === "self-test-translucent-leak") e.push(`${where}: state self-test-translucent-leak is for the runner's self-test only`);
  if (!KINDS.includes(c.kind ?? "color")) e.push(`${where}: kind must be one of ${KINDS.join("/")}`);
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
