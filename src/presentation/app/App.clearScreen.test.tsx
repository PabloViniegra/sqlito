import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { clearScreenSequence } from "./clearScreen.ts";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const CTRL_L = "\x0c";
const UP_ARROW = "\x1b[A";

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

type FakeStdout = NodeJS.WriteStream & {
  isTTY: boolean;
  columns: number;
  rows: number;
  buffer: string;
};

function fakeStdout(columns: number, rows: number): FakeStdout {
  const stream = new PassThrough() as unknown as FakeStdout;
  stream.isTTY = true;
  stream.columns = columns;
  stream.rows = rows;
  stream.buffer = "";
  stream.write = (chunk: string | Uint8Array): boolean => {
    stream.buffer += chunk.toString();
    return true;
  };
  return stream;
}

type FakeStdin = NodeJS.ReadStream & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => FakeStdin;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};

function fakeStdin(): FakeStdin {
  const stream = new PassThrough() as unknown as FakeStdin;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}

async function mountApp(columns = 80, rows = 24) {
  const driver = new BetterSqlite3(":memory:");
  const db = BetterSqliteDatabase.withDriver(driver);
  const schema = new SqliteSchemaRepository(driver);
  const stdout = fakeStdout(columns, rows);
  const stdin = fakeStdin();
  const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
    interactive: true,
  });
  await settle();
  return {
    raw: () => stdout.buffer,
    plain: () => stripAnsi(stdout.buffer).replace(/\r/g, ""),
    send: async (data: string) => {
      stdin.write(data);
      await settle();
      await settle();
    },
    cleanup: async () => {
      instance.unmount();
      await tick();
      driver.close();
    },
  };
}

describe("App Ctrl+L (clear screen)", () => {
  it("writes the clear sequence to stdout and repaints the prompt after it", async () => {
    const app = await mountApp();
    try {
      expect(app.raw()).not.toContain(clearScreenSequence());

      await app.send(CTRL_L);

      const raw = app.raw();
      expect(raw).toContain(clearScreenSequence());
      // Assert content was written AFTER the clear, not just that a prompt
      // frame exists somewhere in the cumulative buffer from before Ctrl+L.
      const afterClear = raw.slice(
        raw.lastIndexOf(clearScreenSequence()) + clearScreenSequence().length,
      );
      expect(stripAnsi(afterClear).replace(/\r/g, "")).toContain(">");
    } finally {
      await app.cleanup();
    }
  });

  it("preserves the readline buffer when the user keeps typing after Ctrl+L", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT 1");
      await app.send(CTRL_L);
      await app.send(";");

      const out = app.plain();
      expect(out).toContain("SELECT 1;");
      expect(app.raw()).toContain(clearScreenSequence());
    } finally {
      await app.cleanup();
    }
  });

  it("does not block subsequent history recall (up-arrow) after Ctrl+L", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT 42 AS n");
      await app.send("\r");
      await app.send(CTRL_L);
      await app.send(UP_ARROW);

      const out = app.plain();
      expect(app.raw()).toContain(clearScreenSequence());
      expect(out).toContain("SELECT 42");
      expect(out).toContain("n");
    } finally {
      await app.cleanup();
    }
  });

  it("renders the prompt near the bottom after Ctrl+L (Option A: flexGrow anchor)", async () => {
    const app = await mountApp(80, 30);
    try {
      await app.send(CTRL_L);
      const lines = app.plain().split("\n");
      const promptIndex = lines.findIndex((l) => l.includes(">"));
      expect(promptIndex).toBeGreaterThan(20);
    } finally {
      await app.cleanup();
    }
  });
});
