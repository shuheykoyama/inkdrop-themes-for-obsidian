// Self-test of the checks in capture-lib.mjs with fake data: each case declares whether the check must pass or name the
// problem it must report. No Obsidian, no window. Leaves its temporary vaults in the OS temp directory.
// usage: node capture-self-test.mjs
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { canvasProblems, graphProblems, incomparableScenes, isolatedVaultProblems, themeProblems } from "./capture-lib.mjs";

let bad = 0;
const expect = (name, problems, want) => {
  const ok = want === null ? problems.length === 0 : problems.some((p) => p.includes(want));
  if (!ok) bad++;
  console.log(`${ok ? "OK  " : "FAIL"} ${name}${ok ? "" : ` -- got ${JSON.stringify(problems)}`}`);
};

// vault
const work = mkdtempSync(path.join(os.tmpdir(), "capture-self-"));
const vault = path.join(work, "vault");
mkdirSync(vault); mkdirSync(path.join(work, "userdata"));
for (const f of ["Code blocks.md", "Mermaid.md", "Sample note.md"]) writeFileSync(path.join(vault, f), "x");
writeFileSync(path.join(work, "userdata/obsidian.json"), JSON.stringify({ vaults: { inkthemetest0001: { path: vault } } }));
expect("isolated vault passes", isolatedVaultProblems(vault, vault), null);
expect("another vault is open", isolatedVaultProblems(vault, os.tmpdir()), "not");
expect("no registry", isolatedVaultProblems(path.join(os.tmpdir()), os.tmpdir()), "missing");
writeFileSync(path.join(work, "userdata/obsidian.json"), JSON.stringify({ vaults: { inkthemetest0001: { path: vault }, other: { path: os.homedir() } } }));
expect("registry holds a second vault", isolatedVaultProblems(vault, vault), "does not register only");

// canvas
const exp = { nodes: [{ id: "n0", type: "text" }, { id: "c1", type: "text", color: "1" }, { id: "f", type: "file" }, { id: "g", type: "group" }], edges: [{ id: "e1", fromNode: "n0", toNode: "c1" }] };
const nodes = exp.nodes.map((n) => ({ ...n, color: n.color ?? null }));
const edges = [{ id: "e1", fromNode: "n0", toNode: "c1", color: null }];
const good = { expected: exp, nodes, edges, outside: [], selected: ["c1"], wanted: "c1" };
expect("canvas passes", canvasProblems(good), null);
expect("canvas passes with nothing selected", canvasProblems({ ...good, selected: [], wanted: null }), null);
expect("a node is missing", canvasProblems({ ...good, nodes: nodes.slice(1) }), "nodes differ");
expect("an edge is missing", canvasProblems({ ...good, edges: [] }), "edges differ");
expect("a node is outside", canvasProblems({ ...good, outside: ["g"] }), "outside");
expect("wrong selection", canvasProblems({ ...good, selected: ["n0"] }), "selection");
expect("selection left over", canvasProblems({ ...good, selected: ["n0"], wanted: null }), "something is selected");
expect("no coloured node", canvasProblems({ ...good, expected: { ...exp, nodes: exp.nodes.filter((n) => n.id !== "c1") }, nodes: nodes.filter((n) => n.id !== "c1"), edges: [], selected: [], wanted: null }), "no coloured text node");

// graph
const gExp = { notes: ["hub.md", "a.md"], tags: ["#t"], attachments: ["p.png"], unresolved: ["missing"], requiredLinks: [["hub.md", "a.md"], ["hub.md", "missing"]] };
const gNodes = [{ id: "hub.md", type: "" }, { id: "a.md", type: "" }, { id: "t", type: "tag" }, { id: "p.png", type: "attachment" }, { id: "missing", type: "unresolved" }];
const gLinks = [{ source: "hub.md", target: "a.md" }, { source: "hub.md", target: "missing" }];
const gOpt = { showTags: true, showAttachments: true };
const g = { expected: gExp, nodes: gNodes, links: gLinks, options: gOpt, wantedOptions: gOpt };
expect("graph passes", graphProblems(g), null);
expect("no tag node", graphProblems({ ...g, nodes: gNodes.filter((n) => n.type !== "tag") }), "no tag node");
expect("no attachment node", graphProblems({ ...g, nodes: gNodes.filter((n) => n.type !== "attachment") }), "no attachment node");
expect("no unresolved node", graphProblems({ ...g, nodes: gNodes.filter((n) => n.type !== "unresolved") }), "no unresolved node");
expect("a required link is missing", graphProblems({ ...g, links: gLinks.slice(0, 1) }), "no link");
expect("a kind is not marked by its type", graphProblems({ ...g, nodes: gNodes.map((n) => ({ ...n, type: "" })) }), "not marked");
expect("an option is off", graphProblems({ ...g, options: { ...gOpt, showTags: false } }), "graph option showTags");

// theme and window
const th = { theme: "T [trial]", wantedTheme: "T [trial]", sha: "a", wantedSha: "a", width: 1200, height: 800, wantedSize: { width: 1200, height: 800 } };
expect("theme passes", themeProblems(th), null);
expect("another theme loaded", themeProblems({ ...th, theme: "T [final]" }), "theme is");
expect("the CSS is not the installed file", themeProblems({ ...th, sha: "b" }), "sha256");
expect("window is smaller", themeProblems({ ...th, height: 700 }), "window is");

// comparability
const rows = [{ condition: "a", scene: "s", sig: { v: 1 } }, { condition: "b", scene: "s", sig: { v: 1 } }];
expect("conditions comparable", incomparableScenes(rows), null);
expect("conditions differ", incomparableScenes([...rows, { condition: "c", scene: "s", sig: { v: 2 } }]), "c differs from a");

console.log(bad ? `${bad} case(s) did not behave as declared` : "all cases behaved as declared");
process.exit(bad ? 1 : 0);
