// Inkdrop 6.3.0's language table: @codemirror/language-data (143 languages) without Markdown, then Elixir, GraphQL, Svelte,
// Nix and Mermaid (Inkdrop's own additions; its extra Julia entry is shadowed by language-data's, which comes first and
// matches the same names), then Markdown with the aliases md, mkd and gfm, parsing the code inside it with this same table.
import { languages } from "@codemirror/language-data";
import { LanguageDescription, LanguageSupport } from "@codemirror/language";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { elixirLanguage } from "codemirror-lang-elixir";
import { graphqlLanguage } from "cm6-graphql";
import { svelte } from "@replit/codemirror-lang-svelte";
import { nix } from "@replit/codemirror-lang-nix";
import { mermaid } from "codemirror-lang-mermaid";
import { inkExtensions } from "./inkdrop-markdown.js";

const others = languages.filter((l) => l.name !== "Markdown");
const extras = [
  LanguageDescription.of({ alias: ["ex", "elixir"], extensions: ["ex", "exs"], name: "Elixir", load: async () => new LanguageSupport(elixirLanguage) }),
  LanguageDescription.of({ alias: ["graphql"], extensions: ["graphql"], name: "GraphQL", load: async () => new LanguageSupport(graphqlLanguage) }),
  LanguageDescription.of({ alias: ["svelte"], extensions: ["svelte"], name: "Svelte", load: async () => svelte() }),
  LanguageDescription.of({ alias: ["nix"], extensions: ["nix"], name: "Nix", load: async () => nix() }),
  LanguageDescription.of({ alias: ["mermaid"], extensions: ["mermaid"], name: "Mermaid", load: async () => mermaid() }),
];
const codeLanguages = [...others, ...extras];
const markdownDesc = LanguageDescription.of({ name: "Markdown", alias: ["md", "mkd", "gfm"], extensions: ["md", "markdown", "mkd", "gfm"],
  load: async () => markdown({ addKeymap: false, base: markdownLanguage, codeLanguages, extensions: inkExtensions }) });
export const table = [...codeLanguages, markdownDesc];
export const find = (info) => LanguageDescription.matchLanguageName(table, info, true);

// Inkdrop's preview resolves languages differently from its editor: language-data's own table (Markdown with no aliases and
// no Inkdrop extensions) plus the extras; `markdown` and `md` (exactly, lower case) are parsed with a Markdown whose nested
// languages are only those named by /```(\w+)/ in the text (backtick fences and word characters only), loaded beforehand.
const previewTable = [...languages, ...extras];
const findPreview = (info) => LanguageDescription.matchLanguageName(previewTable, info, true);
const nestedCache = new Map();
export async function previewParser(info, code) {
  if (info === "markdown" || info === "md") {
    const names = [...code.matchAll(/```(\w+)/g)].map((m) => m[1]);
    const key = names.join("\0");
    if (!nestedCache.has(key)) {
      const found = (await Promise.all(names.map(async (n) => { const d = findPreview(n); if (d) { if (!d.support) await d.load(); if (d.support) return d; } }))).filter(Boolean);
      nestedCache.set(key, markdown({ addKeymap: false, base: markdownLanguage, codeLanguages: found, extensions: inkExtensions }).language.parser);
    }
    return nestedCache.get(key);
  }
  const d = findPreview(info);
  if (!d) return null;
  if (!d.support) await d.load();
  return d.support ? d.support.language.parser : null;
}
