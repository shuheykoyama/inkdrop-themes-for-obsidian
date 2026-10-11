// P1: Vanilla CSS + PostCSS. The only plugin is postcss-import (inlines the @import rules of the
// entry file). No colour conversion, no minification. Output: dist/p1/<theme>.css
//
// usage: node p1-postcss/build.mjs [src_dir] [out_dir]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import postcss from "postcss";
import atImport from "postcss-import";

const root = path.resolve(import.meta.dirname, "..");
const srcDir = path.resolve(process.argv[2] ?? path.join(root, "src"));
const outDir = path.resolve(process.argv[3] ?? path.join(root, "dist", "p1"));
const themes = ["solarized-dark", "kanagawa-dragon"];

await mkdir(outDir, { recursive: true });
for (const theme of themes) {
  const from = path.join(srcDir, "themes", `${theme}.css`);
  const to = path.join(outDir, `${theme}.css`);
  try {
    const result = await postcss([atImport()]).process(await readFile(from, "utf8"), { from, to, map: false });
    for (const w of result.warnings()) console.error(`warning: ${theme}: ${w.toString()}`);
    // A warning from postcss-import (e.g. an @import it could not inline) fails the build.
    if (result.warnings().length) throw new Error("postcss reported warnings");
    await writeFile(to, result.css);
    console.log(`p1: ${path.relative(root, to)}`);
  } catch (err) {
    console.error(`p1: ${theme}: ${err.message}`);
    process.exitCode = 1;
  }
}
