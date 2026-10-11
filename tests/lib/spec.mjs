// Loading and validation of the test specifications (research/14 §3.3):
//   tests/spec/requirements.json   required visual roles of the confirmed Q-D decisions
//   tests/spec/runtime/*.json      runtime checks (each names one requirement)
// Shared by the static tests (S6) and the runtime runner, so a malformed spec fails in both places.
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DOCUMENTS = ["main", "settings"];
const APPEARANCES = ["opaque", "translucent"];
const EXPECTS = ["match", "absent", "hidden"];

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
    const covered = checks.some((c) => c.requirement === r.id);
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
