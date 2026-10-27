// Step 11G G7-1 (research/14 §6.125): the parts of the Inkdrop syntax measurement that decide what counts, as
// small functions the self-test (tests/visual/g7-self-test.mjs) drives without Inkdrop:
//   blocks      the fenced blocks of the verification note, with the body offset of each block's code (the same
//               blocks, in the same order, as tests/visual/inkdrop-tokens.mjs reads)
//   coverage    whether the measured ranges of one block cover every visible character exactly once
//   judgeBlocks the completeness of one theme x view: the measured theme, view and note state are the expected ones,
//               every block found with its exact text and fully measured from the right characters
//   noteDoc     the temporary note's document (inkdrop-model's required fields)
//   removeNote  deletes the temporary note through Inkdrop's notes API and says whether it is gone (also run in the
//               page: it is passed there as source, so it uses nothing from outside its body)
//   requireFocus  the check before a capture: no focus, no capture

// ```lang\n<code>\n``` blocks; `start` is the offset of <code> in the note body.
export function blocks(note) {
  return [...note.matchAll(/^```(\w+)\n([\s\S]*?)\n```$/gm)].map((m) => ({ lang: m[1], code: m[2], start: m.index + 4 + m[1].length }));
}

// ranges: [{ from, to, ... }] in block offsets. Every non-blank character of `code` must lie in exactly one range,
// and no range may leave the block. Returns { missing: [offsets], overlap: [offsets], outside: n }.
export function coverage(code, ranges) {
  const hits = new Array(code.length).fill(0);
  let outside = 0;
  for (const r of ranges) {
    if (!(Number.isInteger(r.from) && Number.isInteger(r.to)) || r.from < 0 || r.to > code.length || r.from >= r.to) { outside++; continue; }
    for (let i = r.from; i < r.to; i++) hits[i]++;
  }
  const missing = [], overlap = [];
  for (let i = 0; i < code.length; i++) {
    if (/\s/.test(code[i])) continue;
    if (hits[i] === 0) missing.push(i);
    else if (hits[i] > 1) overlap.push(i);
  }
  return { missing, overlap, outside };
}

// want: blocks(note); got: the page's result for one theme x view (g7-measure.js: { mode, theme, stateBefore,
// stateAfter, blocks: [{ index, lang, text, ranges }] }); expect: { theme, view }. COMPLETE only when
//   - the result is of that view and theme, and before and after the measurement the theme was that one, the note
//     shown was the recorded one and its title and body (SHA-256 against the record) were unchanged, and in the
//     editor the shown document was that body (the preview has no document: there the note's own body is compared);
//   - every block is there, in order, with its index, language and exact text;
//   - every visible character is measured once with a colour, from the characters it claims (range.text equals the
//     block's code at from..to: a range in the right place but read from other text is not a measurement of it).
// Anything else is INCOMPLETE with the reasons (never a partial success); a state that is missing counts as wrong.
export function judgeBlocks(want, got, expect) {
  const problems = [];
  if (!got || !Array.isArray(got.blocks)) return { state: "INCOMPLETE", problems: ["no block results"] };
  if (got.mode !== expect.view) problems.push(`measured the ${got.mode} view, not the ${expect.view}`);
  if (got.theme !== expect.theme) problems.push(`measured theme ${got.theme}, not ${expect.theme}`);
  for (const [when, s] of [["before", got.stateBefore], ["after", got.stateAfter]]) {
    if (!s) { problems.push(`no state ${when} the measurement`); continue; }
    if (s.theme !== expect.theme) problems.push(`theme ${when} the measurement: ${s.theme}`);
    if (s.noteShown !== true) problems.push(`${when} the measurement another note (or none) was shown`);
    if (s.titleSame !== true || s.bodySame !== true) problems.push(`${when} the measurement the note's title or body was not the one created (or could not be read)`);
    if (expect.view === "editor" && s.shownBodySame !== true) problems.push(`${when} the measurement the editor did not show the note's body`);
  }
  if (got.blocks.length !== want.length) problems.push(`${got.blocks.length} blocks measured, ${want.length} expected`);
  want.forEach((w, i) => {
    const g = got.blocks[i];
    if (!g) return problems.push(`block ${i} (${w.lang}): not measured`);
    if (g.index !== i || g.lang !== w.lang) return problems.push(`block ${i} (${w.lang}): the result is of block ${g.index} (${g.lang})`);
    if (g.error) return problems.push(`block ${i} (${w.lang}): ${g.error}`);
    if (g.text !== w.code) return problems.push(`block ${i} (${w.lang}): the shown text differs from the note`);
    const wrongText = (g.ranges ?? []).filter((r) => r.text !== w.code.slice(r.from, r.to)).length;
    if (wrongText) problems.push(`block ${i} (${w.lang}): ${wrongText} ranges whose text is not the block's text at their place`);
    const c = coverage(w.code, g.ranges ?? []);
    if (c.missing.length) problems.push(`block ${i} (${w.lang}): ${c.missing.length} characters not measured`);
    if (c.overlap.length) problems.push(`block ${i} (${w.lang}): ${c.overlap.length} characters measured twice`);
    if (c.outside) problems.push(`block ${i} (${w.lang}): ${c.outside} ranges outside the block`);
    const noColour = (g.ranges ?? []).filter((r) => typeof r.color !== "string" || !r.color.startsWith("rgb")).length;
    if (noColour) problems.push(`block ${i} (${w.lang}): ${noColour} ranges without a computed colour`);
  });
  return { state: problems.length ? "INCOMPLETE" : "COMPLETE", problems };
}

// The temporary note: a title that says what it is, the verification note's body, in the given notebook.
export const NOTE_TITLE = "G7 syntax verification (temporary; deleted by the run)";
export function noteDoc({ id, bookId, body, now }) {
  return { _id: id, bookId, title: NOTE_TITLE, doctype: "markdown", body, updatedAt: now, createdAt: now, timestamp: now, tags: [], status: "none", share: "private", pinned: false };
}

// db: inkdrop.localDB.notes; rec: the private record ({ id, title, bodySha256 }). Only the note this run created
// (same ID, title and body hash) is deleted. Absence is taken only from the error Inkdrop 6.2.0 gives for a missing
// or deleted note: notes.get is PouchDB's get in the main process, whose error keeps name "not_found" and status 404
// across IPC (main VA, renderer Za; research/14 §6.127). Any other error, or a note still found after the delete,
// is NOT REMOVED: the note's absence is not proven.
export async function removeNote(db, rec) {
  const notFound = (e) => e?.name === "not_found" && e?.status === 404;
  const why = (e) => `${e?.name ?? "error"}${e?.status ? ` ${e.status}` : ""}: ${e?.message ?? e}`;
  const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  let d;
  try { d = await db.get(rec.id); } catch (e) { return notFound(e) ? { state: "ABSENT" } : { state: "NOT REMOVED", why: `the note could not be read (${why(e)})` }; }
  if (d?._id !== rec.id || d.title !== rec.title || (await sha(d.body ?? "")) !== rec.bodySha256) return { state: "NOT REMOVED", why: "the note is not the one this run created (title or body changed)" };
  try { await db.remove(rec.id); } catch (e) { return { state: "NOT REMOVED", why: `the delete failed (${why(e)})` }; }
  try { await db.get(rec.id); } catch (e) { return notFound(e) ? { state: "REMOVED" } : { state: "NOT REMOVED", why: `its absence could not be confirmed (${why(e)})` }; }
  return { state: "NOT REMOVED", why: "still found after the delete" };
}

// focus: what the page said right before the capture. Throws (so the capture is not taken) unless it had focus.
export function requireFocus(focus) {
  if (focus?.focused !== true) throw new Error("the Inkdrop window did not have focus; no capture taken");
  return focus;
}
