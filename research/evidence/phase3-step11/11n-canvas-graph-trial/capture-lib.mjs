// Pure checks used by capture.mjs (research/14 §6.172). They take plain data, so capture-self-test.mjs can run them
// without Obsidian. Each returns a list of problems; an empty list means the check passed.
import { existsSync, readFileSync, realpathSync } from "node:fs";
import path from "node:path";

const realOrNull = (p) => { try { return realpathSync(p); } catch { return null; } };

// The vault the running Obsidian has open must be the isolated test vault made by tests/runtime/obsidian-isolated.sh:
// registered alone in <work>/userdata/obsidian.json under the test id, and holding the fixture notes.
export function isolatedVaultProblems(vault, pageBasePath) {
  const real = realOrNull(vault);
  if (!real) return [`vault ${vault} does not exist`];
  const problems = [];
  if (realOrNull(pageBasePath) !== real) problems.push(`the running Obsidian has ${pageBasePath} open, not ${real}`);
  const reg = path.join(real, "..", "userdata", "obsidian.json");
  if (!existsSync(reg)) problems.push(`${reg} is missing: not a vault made by tests/runtime/obsidian-isolated.sh`);
  else {
    let vaults = {};
    try { vaults = JSON.parse(readFileSync(reg, "utf8")).vaults ?? {}; } catch { problems.push(`${reg} is not JSON`); }
    const only = Object.entries(vaults);
    if (only.length !== 1 || only[0][0] !== "inkthemetest0001" || realOrNull(only[0][1].path) !== real) problems.push(`${reg} does not register only the isolated test vault`);
  }
  for (const f of ["Code blocks.md", "Mermaid.md", "Sample note.md"]) if (!existsSync(path.join(real, f))) problems.push(`fixture ${f} is missing`);
  return problems;
}

// Every condition must show the same state: for each scene, the signatures of all conditions are equal.
export function incomparableScenes(rows) {
  const byScene = new Map();
  for (const r of rows) (byScene.get(r.scene) ?? byScene.set(r.scene, []).get(r.scene)).push(r);
  const problems = [];
  for (const [scene, list] of byScene) {
    const first = JSON.stringify(list[0].sig);
    for (const r of list.slice(1)) if (JSON.stringify(r.sig) !== first) problems.push(`${scene}: ${r.condition} differs from ${list[0].condition}`);
  }
  return problems;
}

// Canvas: what is on the canvas must be exactly what was written, every node must be inside the visible area,
// and the requested selection must be the selection. `expected` comes from the canvas file that was written.
export function canvasProblems({ expected, nodes, edges, outside, selected, wanted }) {
  const problems = [];
  const key = (n) => `${n.id}|${n.type}|${n.color ?? ""}`;
  const want = expected.nodes.map(key).sort(), got = nodes.map(key).sort();
  if (JSON.stringify(want) !== JSON.stringify(got)) problems.push(`canvas nodes differ: wanted ${want.join(", ")}; got ${got.join(", ")}`);
  const ek = (e) => `${e.id}|${e.fromNode ?? e.from}|${e.toNode ?? e.to}|${e.color ?? ""}`;
  const ew = expected.edges.map(ek).sort(), eg = edges.map(ek).sort();
  if (JSON.stringify(ew) !== JSON.stringify(eg)) problems.push(`canvas edges differ: wanted ${ew.join(", ")}; got ${eg.join(", ")}`);
  const types = new Set(nodes.map((n) => n.type));
  for (const t of ["text", "file", "group"]) if (!types.has(t)) problems.push(`no ${t} node on the canvas`);
  if (!nodes.some((n) => n.type === "text" && !n.color)) problems.push("no uncoloured text node");
  if (!nodes.some((n) => n.type === "text" && n.color)) problems.push("no coloured text node");
  if (outside.length) problems.push(`nodes outside the visible area: ${outside.join(", ")}`);
  if (wanted !== null && JSON.stringify([...selected].sort()) !== JSON.stringify([wanted])) problems.push(`selection is [${selected.join(", ")}], wanted [${wanted}]`);
  if (wanted === null && selected.length) problems.push(`something is selected: [${selected.join(", ")}]`);
  return problems;
}

// Graph: the expected ids come from the vault's metadata cache (not from assumed id forms): every note, tag,
// attachment and unresolved link must be a node, the required note links must be links, and each special kind must be
// marked by a node `type` different from a plain note's (so the colour variables can show on screen).
export function graphProblems({ expected, nodes, links, options, wantedOptions }) {
  const problems = [];
  const norm = (id) => String(id).replace(/^#/, "").replace(/\.md$/, "");
  const byId = new Map(nodes.map((n) => [norm(n.id), n]));
  const missing = (kind, ids) => { for (const id of ids) if (!byId.has(norm(id))) problems.push(`no ${kind} node for ${id}`); };
  missing("note", expected.notes); missing("tag", expected.tags); missing("attachment", expected.attachments); missing("unresolved", expected.unresolved);
  const linked = new Set(links.map((l) => `${norm(l.source)}>${norm(l.target)}`));
  for (const [a, b] of expected.requiredLinks) if (!linked.has(`${norm(a)}>${norm(b)}`) && !linked.has(`${norm(b)}>${norm(a)}`)) problems.push(`no link ${a} - ${b}`);
  const typeOf = (ids) => new Set(ids.map((id) => byId.get(norm(id))?.type));
  const plain = typeOf(expected.notes);
  for (const [kind, ids] of [["tag", expected.tags], ["attachment", expected.attachments], ["unresolved", expected.unresolved]]) {
    const t = typeOf(ids);
    if ([...t].some((x) => plain.has(x))) problems.push(`${kind} nodes share a type with plain notes (${[...t].join("/")} vs ${[...plain].join("/")}): the kind is not marked`);
  }
  for (const [k, v] of Object.entries(wantedOptions)) if (options?.[k] !== v) problems.push(`graph option ${k} is ${JSON.stringify(options?.[k])}, wanted ${JSON.stringify(v)}`);
  return problems;
}

// The loaded theme CSS must be the file that was installed, and the window the size the shots are taken at.
export function themeProblems({ theme, wantedTheme, sha, wantedSha, width, height, wantedSize }) {
  const problems = [];
  if (theme !== wantedTheme) problems.push(`theme is ${theme}, wanted ${wantedTheme}`);
  if (sha !== wantedSha) problems.push(`loaded CSS sha256 ${sha} is not the installed file's ${wantedSha}`);
  if (width !== wantedSize.width || height !== wantedSize.height) problems.push(`window is ${width}x${height}, wanted ${wantedSize.width}x${wantedSize.height}`);
  return problems;
}
