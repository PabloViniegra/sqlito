import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    cli: "src/main.tsx",
    // loaded at runtime by WorkerDatabase via new URL("./sqliteWorker.js")
    sqliteWorker: "src/infrastructure/sqlite/sqliteWorker.ts",
  },
  format: ["esm"],
  outDir: "dist",
  clean: true,
  banner: {
    // bundled CommonJS dependencies call require() for Node builtins
    js: '#!/usr/bin/env node\nimport { createRequire } from "node:module";\nconst require = createRequire(import.meta.url);',
  },
  // inlining the pure-JS graph (ink pulls hundreds of ESM files) halves cold
  // start; native and binary-shipping packages must stay on disk
  // (ink imports react-devtools-core only when DEV=true; it is not installed)
  noExternal: [/^(?!better-sqlite3$|clipboardy$|react-devtools-core$)/],
  external: ["better-sqlite3", "clipboardy", "react-devtools-core"],
});
