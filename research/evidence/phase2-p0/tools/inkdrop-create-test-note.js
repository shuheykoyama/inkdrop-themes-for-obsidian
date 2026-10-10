// Creates ONE test notebook and ONE sample note for Phase 2B (approved by the user). Returns only the new IDs.
(async () => {
  const db = inkdrop.localDB;
  const now = Date.now();
  const bookId = await db.books.createId();
  await db.books.put({ _id: bookId, name: "Theme Validation (Phase 2B)", count: 0, parentBookId: null, createdAt: now, updatedAt: now });
  const noteId = await db.notes.createId();
  await db.notes.put({ _id: noteId, doctype: "markdown", bookId, createdAt: now, updatedAt: now, status: "none", share: "private",
    numOfTasks: 2, numOfCheckedTasks: 1, pinned: false, title: "Sample note", body: "# Heading 1\n\nParagraph with **bold**, *italic*, `inline code`, a [link](https://example.com) and an [[Other note]].\n\n## Heading 2\n\n- item one\n  - nested item\n- [ ] task\n- [x] done task\n\n> quote line\n\n```js\nfunction foo(bar) {\n  const x = bar.prop;\n  return foo(x);\n}\n```\n\n| a | b |\n|---|---|\n| 1 | 2 |\n", tags: [] });
  return { bookId, noteId };
})();