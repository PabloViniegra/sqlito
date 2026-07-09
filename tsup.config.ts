import { defineConfig } from "tsup";
import pkg from "./package.json" with { type: "json" };

export default defineConfig({
  entry: { cli: "src/main.tsx" },
  format: ["esm"],
  outDir: "dist",
  clean: true,
  banner: { js: "#!/usr/bin/env node" },
  external: Object.keys(pkg.dependencies),
});
