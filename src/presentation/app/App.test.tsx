import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import stripAnsi from "strip-ansi";
import { describe, expect, it, vi } from "vitest";

vi.mock("ink", async () => {
  const ink = await vi.importActual<typeof import("ink")>("ink");
  return { ...ink, useInput: () => {} };
});

import { render } from "ink";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

type FakeTty = NodeJS.WriteStream & {
  columns: number;
  rows: number;
  isTTY: boolean;
  buffer: string;
};

function fakeTty(columns: number, rows: number): FakeTty {
  const stream = new PassThrough() as unknown as FakeTty;
  stream.columns = columns;
  stream.rows = rows;
  stream.isTTY = true;
  stream.buffer = "";
  stream.write = (chunk: string | Uint8Array): boolean => {
    stream.buffer += chunk.toString();
    return true;
  };
  return stream;
}

async function renderApp(
  columns: number,
  rows: number,
): Promise<{ plain: string; lines: string[] }> {
  const driver = new BetterSqlite3(":memory:");
  try {
    const db = BetterSqliteDatabase.withDriver(driver);
    const schema = new SqliteSchemaRepository(driver);
    const tty = fakeTty(columns, rows);
    const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
      stdout: tty as NodeJS.WriteStream,
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
