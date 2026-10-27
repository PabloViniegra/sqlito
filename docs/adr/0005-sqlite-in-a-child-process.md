# ADR-0005: SQLite in a child process, capped results, bundled CLI

- **Status:** accepted
- **Date:** 2026-10-27

## Context

better-sqlite3 is synchronous. Run on the main thread, a slow statement
freezes Ink: no repaint, no keyboard, and ^C cannot interrupt it. Results
were also fully materialised with `.all()`, so `SELECT * FROM big_table`
could exhaust memory before the first row was drawn. The bundled CLI took
~550 ms to its first byte because Node resolved hundreds of ESM files from
`node_modules` at start-up.

better-sqlite3 12.x does not expose `sqlite3_interrupt`, so a running
statement can only be stopped by stopping whatever executes it.

## Decision

1. **SQLite runs in a forked child process** (`WorkerDatabase` +
   `sqliteWorker`), talking over IPC with `serialization: "advanced"` so
   `bigint` and `Uint8Array` values cross intact.
   - `worker_threads` was tried first and rejected. A thread blocked inside
     native SQLite ignores `worker.terminate()`, and the process then cannot
     exit (even `process.exit()` waits for it), keeps burning CPU and keeps
     its file locks.
   - **Cancellation is `SIGKILL` plus a respawn** on the same path. The OS
     releases the locks immediately. The cost is connection state: an open
     `BEGIN`, temp tables, `ATTACH`ed databases and per-connection `PRAGMA`s
     are lost. The status bar says "connection reset" so the user knows.
   - The child is only `ref`ed while a request is pending, so an idle
     connection never keeps the CLI alive.
   - Ink's `exitOnCtrlC` is off: ^C cancels a running query and quits
     otherwise.
2. **Results are capped at `MAX_RESULT_ROWS` (1000)** via `iterate()`; the
   card shows "capped, rest not loaded". For a capped read-only statement,
   `.export` re-runs it in the child and streams every row to a temp file
   renamed over the destination on success, and `.copy` re-runs it
   uncapped; a capped write is never re-run, so both keep the loaded rows.
3. **The schema is cached** in `SqliteSchemaRepository` and refreshed after
   statements that can change it, with a generation guard against stale
   refreshes.
4. **The CLI is bundled** by tsup with every pure-JS dependency inlined.
   `better-sqlite3` (native), `clipboardy` (ships binaries, now loaded
   lazily) and `react-devtools-core` (dev-only, not installed) stay
   external. `main.tsx` enables the V8 compile cache before importing the
   app.

## Consequences

- Cold start: ~240 ms in `pnpm bench`, ~180 ms to the first full frame in
  a real TTY (was ~550 / ~450 ms). The remaining cost is evaluating
  Ink/React/yoga; <100 ms would require replacing Ink.
- Each session runs two Node processes.
- Cancelling inside an explicit transaction rolls it back (and loses temp
  tables and ATTACHed databases); the cancel message says so.
- Only `better-sqlite3` and `clipboardy` remain runtime `dependencies`;
  everything else is inlined in `dist/` and lives in `devDependencies`.
