// Step 11G G6 (research/14 §6.105): the parts of a V-35 capture that must hold even when something fails, as
// small functions the self-test (tests/visual/g6-self-test.py) can drive without Inkdrop:
//   shoot      one native capture with the backdrop window behind; the backdrop is always closed, and a capture
//              whose command failed or left no PNG is an error, never a result
//   splitNote  the shown note's identity (ID, revision, body hash) out of a probe: the public record keeps only
//              whether it stayed the same, the identity goes to the private file
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// backdrop: [command, ...args] of the backdrop window; capture: [command, ...args] writing `file`;
// between(): what to do with the backdrop up (focus the window, probe). Returns between()'s result.
export async function shoot({ backdrop, capture, file, between = async () => null, settleMs = 1000 }) {
  const b = spawn(backdrop[0], backdrop.slice(1), { stdio: "ignore" });
  try {
    await sleep(settleMs);
    if (b.exitCode !== null) throw new Error(`the backdrop window exited (${b.exitCode})`);
    const got = await between();
    const c = spawnSync(capture[0], capture.slice(1), { encoding: "utf8", timeout: 30000 });
    if (c.status !== 0) throw new Error(`screencapture exited ${c.status}`);
    if (!existsSync(file) || statSync(file).size < 100 || readFileSync(file).subarray(1, 4).toString() !== "PNG") throw new Error("no PNG image was written");
    return got;
  } finally {
    // Close the backdrop whatever happened; wait until it is gone so the next capture never sees two.
    if (b.exitCode === null) b.kill("SIGTERM");
    for (let i = 0; i < 30 && b.exitCode === null && b.signalCode === null; i++) await sleep(100);
    if (b.exitCode === null && b.signalCode === null) b.kill("SIGKILL");
  }
}

// before / after: g6-probe.js results. Returns { public: probes without the note identity plus noteUnchanged,
// private: the identities }.
export function splitNote(before, after) {
  const strip = (p) => { const { note, ...rest } = p; return rest; };
  const same = !!before.note && !!after.note && JSON.stringify(before.note) === JSON.stringify(after.note);
  return { public: { probeBefore: strip(before), probeAfter: strip(after), noteUnchanged: same }, private: { before: before.note ?? null, after: after.note ?? null } };
}
