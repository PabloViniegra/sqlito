import module from "node:module";

// Caches V8 bytecode for the bundle on disk; must run before the app is imported.
// Optional chaining: the API only exists on Node >= 22.1.
module.enableCompileCache?.();

const { run } = await import("./cli.tsx");
run(process.argv);
