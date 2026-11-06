import esbuild from "esbuild";
await esbuild.build({ entryPoints: ["plugin/main.js"], bundle: true, format: "cjs", outfile: "plugin/out/main.js", platform: "browser", target: "es2020",
  external: ["obsidian","electron","@codemirror/state","@codemirror/view"], logLevel: "info" });
