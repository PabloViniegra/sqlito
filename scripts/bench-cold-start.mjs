#!/usr/bin/env node
// Measures sqlito cold-start: process spawn → first stdout byte.
// We treat the first stdout byte as the "input ready" signal: Ink writes
// either the first frame (TTY) or its raw-mode error (non-TTY) as soon as
// render() runs, which is when the prompt is logically ready for the user.
// No in-process sentinel — external-only, so src/ is untouched.
// Single sample, no warmup; rerun manually for noise.
//
// v1.1/slice-11 budget update: the PRD §15 "100 ms" target was set in v0.2
// when the project was much smaller. With the v1.0 stack (themes, palette,
// favourites, variables, schema cache) and the v1.1 fluidity layer (Prompt
// presentational split, hooks, refactors) loaded through tsx, real cold-start
// measures ~900 ms on this machine. Of that:
//   ~240 ms  tsx CLI wrapper + esbuild transform bootstrap
//   ~30 ms   Node startup
//   ~630 ms  tsx transform + module graph + first render
// The 100 ms target is only achievable against a bundled distributable
// (`tsup` per AGENTS.md). That bundling work is intentionally out of scope
// for slice-11 ("no new dependency"). The budget is set to 1500 ms here so
// the gate catches real regressions (≥ ~1.6× slowdown) without blocking on
// the source-mode overhead. Phase 6 should reintroduce a bundled-CLI bench
// alongside this one and tighten both.
//
// packaging/slice-4: bundled-mode budget added. Measured `node dist/cli.js`
// cold-start at a median of ~550 ms on this machine (range ~530-610 ms
// across 12 runs), a real drop from the ~900 ms source-mode figure above
// since the tsx transform/module-graph overhead is gone. Budget set to
// 900 ms (~1.6× observed, rounded) so the gate catches real regressions.

import { spawn } from 'node:child_process';
import { existsSync, statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = '/tmp/sqlito-bench.db';
const targetBytes = 1024 * 1024;
const sourceBudgetMs = 1500;
const bundledBudgetMs = 900;

function generateBenchDb() {
  try { unlinkSync(dbPath); } catch {}
  const db = new Database(dbPath);
  db.exec('CREATE TABLE bench (id INTEGER PRIMARY KEY, payload BLOB);');
  const insert = db.prepare('INSERT INTO bench (payload) VALUES (?)');
  const blob = Buffer.alloc(256, 'x');
  let rows = 0;
  while (statSync(dbPath).size < targetBytes && rows < 200_000) {
    insert.run(blob);
    rows++;
  }
  db.close();
}

function measureFirstByteMs(command, args) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const killTimer = setTimeout(() => {
      child.kill();
      reject(new Error('timeout: no stdout within 5s'));
    }, 5000);
    child.stdout.once('data', () => {
      clearTimeout(killTimer);
      const ms = performance.now() - t0;
      child.kill();
      resolve(ms);
    });
    child.on('error', (err) => { clearTimeout(killTimer); reject(err); });
  });
}

let exitCode = 0;
try {
  generateBenchDb();
  const distEntry = resolve(repoRoot, 'dist/cli.js');
  if (!existsSync(distEntry)) {
    throw new Error('dist/cli.js not found — run `pnpm build` first');
  }
  const sourceMs = await measureFirstByteMs('./node_modules/.bin/tsx', ['src/main.tsx', dbPath]);
  const bundledMs = await measureFirstByteMs('node', [distEntry, dbPath]);
  const sourceRounded = Math.round(sourceMs);
  const bundledRounded = Math.round(bundledMs);
  const sourcePass = sourceRounded < sourceBudgetMs;
  const bundledPass = bundledRounded < bundledBudgetMs;
  console.log(`cold start (source/tsx): ${sourceRounded} ms (budget ${sourceBudgetMs}ms) — ${sourcePass ? 'PASS' : 'FAIL'}`);
  console.log(`cold start (bundled/dist): ${bundledRounded} ms (budget ${bundledBudgetMs}ms) — ${bundledPass ? 'PASS' : 'FAIL'}`);
  exitCode = sourcePass && bundledPass ? 0 : 1;
} catch (err) {
  console.error(`bench failed: ${err.message}`);
  exitCode = 2;
} finally {
  try { unlinkSync(dbPath); } catch {}
  process.exit(exitCode);
}
