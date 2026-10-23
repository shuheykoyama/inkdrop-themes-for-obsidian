// Step 11G G6 (research/14 §6.95, §6.105): read-only inventory of the notes in the Inkdrop on 9334 (isolated,
// or the user's in method C), to see whether one can show every V-35 state (a plain text line, a line inside a fenced code block). Nothing is opened or
// written. Only notes tagged as Inkdrop's tutorial are looked into (§6.103.2): their bodies are hashed and
// scanned here and never returned; every other note is only counted.
//
// Return shapes in Inkdrop 6.2.0 (read statically from its app.asar, research/14 §6.113): tags.all gives an array
// of tag docs; notes.findWithTag gives { query, rows, cursor, ... } whose rows are { doc } (index store) or the
// notes themselves (SQL store); notes.count a number; db.info is not exposed to the page. A shape other than these
// is an error (the run stops), never an empty result.
(async () => {
  const db = inkdrop.localDB;
  const tags = await db.tags.all();
  if (!Array.isArray(tags) || tags.some((t) => !t || typeof t._id !== "string")) throw new Error("tags.all: unexpected result shape");
  const tutorial = new Set(tags.filter((t) => /^tutorial$/i.test(t.name)).map((t) => t._id));
  // Only the tutorial-tagged notes are fetched (findWithTag); the rest are only counted.
  const notes = [];
  for (const id of tutorial) {
    const res = await db.notes.findWithTag(id, { includeDocs: true, limit: 50 });
    if (!res || !Array.isArray(res.rows)) throw new Error("notes.findWithTag: unexpected result shape (no rows)");
    for (const row of res.rows) {
      const n = row && typeof row === "object" && "doc" in row ? row.doc : row;
      if (!n || typeof n._id !== "string" || typeof n.body !== "string") throw new Error("notes.findWithTag: a row without a note (_id, body)");
      if (!notes.some((x) => x._id === n._id)) notes.push(n);
    }
  }
  // The total is only reported; null when the call gives no number.
  const count = await db.notes.count().then((c) => (typeof c === "number" ? c : null), () => null);
  const sha = async (s) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
  const out = [];
  for (const n of notes) {
    const lines = (n.body ?? "").split("\n");
    let fence = null;
    const code = [];
    const plain = [];
    lines.forEach((l, i) => {
      // Inside a fence: every line until the closing fence of the same marker.
      if (fence) { if (l.trim().startsWith(fence)) fence = null; else if (l.trim()) code.push(i + 1); return; }
      const m = l.trim().match(/^(`{3,}|~{3,})/);
      if (m) { fence = m[1]; return; }
      // A plain text line: words, not a heading, list, quote, table, link-only or image line.
      if (/^[A-Za-z][^#>|!\[]*\s\w+/.test(l) && l.length > 20) plain.push(i + 1);
    });
    out.push({ _id: n._id, _rev: n._rev, updatedAt: n.updatedAt, title: n.title, tutorial: true,
      bodySha256: await sha(n.body ?? ""), lines: lines.length, plainLines: plain.slice(0, 5), codeLines: code.slice(0, 5),
      // A word of the first plain line to search for (state 2): it is then found on the active line.
      plainWord: plain.length ? (lines[plain[0] - 1].match(/[A-Za-z]{5,}/) ?? [null])[0] : null });
  }
  return { count, tutorialTags: tutorial.size, notes: out };
})();
