import esbuild from "esbuild";
import builtins from "builtin-modules";

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtins],
  format: "cjs",
  target: "es2022",
  platform: "browser",
  outfile: "main.js",
  sourcemap: false,
  minify: false,
  logLevel: "info",
});
