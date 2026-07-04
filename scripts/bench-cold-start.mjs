#!/usr/bin/env node
// Measures sqlito cold-start: process spawn → first stdout byte.
// PRD §15 says "input ready" should arrive within 100 ms. We treat the first
// stdout byte as that signal: Ink writes either the first frame (TTY) or its
// raw-mode error (non-TTY) as soon as render() runs, which is when the prompt
// is logically ready for the user. No in-process sentinel — external-only,
// so src/ is untouched. Single sample, no warmup; rerun manually for noise.

import { spawn } from 'node:child_process';
import { statSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dbPath = '/tmp/sqlito-bench.db';
const targetBytes = 1024 * 1024;
const budgetMs = 100;

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

function measureFirstByteMs() {
  return new Promise((resolve, reject) => {
    const t0 = performance.now();
    const child = spawn('./node_modules/.bin/tsx', ['src/main.tsx', dbPath], {
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
  const ms = await measureFirstByteMs();
  const rounded = Math.round(ms);
  const pass = rounded < budgetMs;
  console.log(`cold start: ${rounded} ms (budget ${budgetMs}ms) — ${pass ? 'PASS' : 'FAIL'}`);
  exitCode = pass ? 0 : 1;
} catch (err) {
  console.error(`bench failed: ${err.message}`);
  exitCode = 2;
} finally {
  try { unlinkSync(dbPath); } catch {}
  process.exit(exitCode);
}
