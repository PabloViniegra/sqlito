import BetterSqlite3 from "better-sqlite3";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";

import { render } from "ink";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";
import { fakeStdin, fakeStdout } from "../../shared/utils/inkTestStreams.ts";

async function renderApp(
  columns: number,
  rows: number,
): Promise<{ plain: string; lines: string[] }> {
  const driver = new BetterSqlite3(":memory:");
  try {
    const db = new BetterSqliteDatabase(driver);
    const schema = new SqliteSchemaRepository(db);
    const tty = fakeStdout(columns, rows);
    const stdin = fakeStdin();
    // SAFETY: Ink's render accepts Node streams; the augmented PassThrough satisfies NodeJS.WriteStream at runtime.
    const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
      stdin,
      stdout: tty,
      exitOnCtrlC: false,
      patchConsole: false,
      interactive: true,
    });
    await new Promise<void>((r) => setImmediate(r));
    instance.unmount();
    await new Promise<void>((r) => setImmediate(r));
    const plain = stripAnsi(tty.buffer).replace(/\r/g, "");
    return { plain, lines: plain.split("\n") };
  } finally {
    driver.close();
  }
}

describe("App viewport layout", () => {
  it("anchors the prompt near the bottom of a tall viewport", async () => {
    const { lines } = await renderApp(80, 30);

    const promptLineIndex = lines.findIndex((l) => l.includes("▌"));
    expect(promptLineIndex).toBeGreaterThan(5);
    expect(promptLineIndex).toBeGreaterThanOrEqual(24);
    expect(lines.length).toBeGreaterThanOrEqual(28);
  });

  it("keeps the prompt near the bottom in a short viewport too", async () => {
    const { lines } = await renderApp(80, 12);
    const promptLineIndex = lines.findIndex((l) => l.includes("▌"));
    expect(promptLineIndex).toBeGreaterThan(5);
    expect(promptLineIndex).toBeGreaterThanOrEqual(6);
  });
});
