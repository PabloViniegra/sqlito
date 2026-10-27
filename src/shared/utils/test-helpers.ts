import type { Database, SqliteValue } from "../../domain/database/Database.ts";

/**
 * Cast a partial mock object to a fully-typed interface for test injection.
 * Tests supply only the methods the system-under-test will exercise, so the
 * stub is intentionally narrower than the production interface.
 */
export function stub<T>(partial: Partial<T>): T {
  // SAFETY: test stubs omit dependencies the system-under-test won't invoke; full interfaces would couple tests to methods they don't exercise.
  return partial as T;
}
export async function allRows(
  db: Database,
  sql: string,
): Promise<readonly SqliteValue[][]> {
  const result = await db.execute(sql);
  return result.kind === "rows" ? result.rows : [];
}

/** Waits until an Ink fake stdout stops receiving writes, e.g. after an async submit settles. */
export async function untilQuiet(
  progress: () => number,
  intervalMs = 30,
  timeoutMs = 1500,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let last = -1;
  let stable = 0;
  while (stable < 2 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    const now = progress();
    stable = now === last ? stable + 1 : 0;
    last = now;
  }
}
