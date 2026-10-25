// Step 11G G7-1 (research/14 §6.125): the parts of the Inkdrop syntax measurement that decide what counts, as
// small functions the self-test (tests/visual/g7-self-test.mjs) drives without Inkdrop:
//   blocks      the fenced blocks of the verification note, with the body offset of each block's code (the same
//               blocks, in the same order, as tests/visual/inkdrop-tokens.mjs reads)
//   coverage    whether the measured ranges of one block cover every visible character exactly once
//   judgeBlocks the completeness of one theme x view: every block found with its exact text and fully measured
//   noteDoc     the temporary note's document (inkdrop-model's required fields)

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

// want: blocks(note); got: the page's result for one theme x view ({ blocks: [{ index, lang, text, ranges }] }).
// COMPLETE only when every block is there, in order, with its exact text, and every visible character is measured
// once with a colour; anything else is INCOMPLETE with the reasons (never a partial success).
export function judgeBlocks(want, got) {
  const problems = [];
  if (!got || !Array.isArray(got.blocks)) return { state: "INCOMPLETE", problems: ["no block results"] };
  if (got.blocks.length !== want.length) problems.push(`${got.blocks.length} blocks measured, ${want.length} expected`);
  want.forEach((w, i) => {
    const g = got.blocks[i];
    if (!g) return problems.push(`block ${i} (${w.lang}): not measured`);
    if (g.error) return problems.push(`block ${i} (${w.lang}): ${g.error}`);
    if (g.text !== w.code) return problems.push(`block ${i} (${w.lang}): the shown text differs from the note`);
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
