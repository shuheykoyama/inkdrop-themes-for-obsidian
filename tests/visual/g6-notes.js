// Step 11G G6 (research/14 §6.95): read-only inventory of the notes in the isolated Inkdrop, to see whether
// one can show every V-35 state (a plain text line, a line inside a fenced code block). Nothing is opened or
// written. Bodies are hashed and scanned here and never returned; a title is returned only for a note tagged
// as Inkdrop's tutorial, every other note is reported as "<other>".
(async () => {
  const db = inkdrop.localDB;
  const tags = await db.tags.all().catch(() => null);
  const tutorial = new Set(((tags?.docs ?? tags) || []).filter((t) => /^tutorial$/i.test(t.name)).map((t) => t._id));
  const res = await db.notes.all({ limit: 200 }).catch(() => null);
  const notes = res?.docs ?? res ?? [];
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
    const isTutorial = (n.tags ?? []).some((t) => tutorial.has(t));
    out.push({ _id: n._id, _rev: n._rev, updatedAt: n.updatedAt, title: isTutorial ? n.title : "<other>", tutorial: isTutorial,
      bodySha256: await sha(n.body ?? ""), lines: lines.length, plainLines: plain.slice(0, 5), codeLines: code.slice(0, 5) });
  }
  const info = await db.info?.().catch(() => null);
  return { count: notes.length, updateSeq: info?.update_seq ?? null, docCount: info?.doc_count ?? null, notes: out };
})();
