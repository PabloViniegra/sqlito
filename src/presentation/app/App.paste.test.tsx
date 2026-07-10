import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const PASTE_START = "\u001B[200~";
const PASTE_END = "\u001B[201~";

const tick = () => new Promise<void>((r) => setImmediate(r));
const settle = () => new Promise<void>((r) => setTimeout(r, 30));

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

async function mountApp() {
  const driver = new BetterSqlite3(":memory:");
  const db = BetterSqliteDatabase.withDriver(driver);
  const schema = new SqliteSchemaRepository(driver);
  const stdout = fakeStdout(80, 24);
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
    output: () => stripAnsi(stdout.buffer).replace(/\r/g, ""),
    async send(data: string) {
      stdin.write(data);
      await settle();
      await settle();
    },
    async cleanup() {
      instance.unmount();
      await tick();
      driver.close();
    },
  };
}

describe("App bracketed paste", () => {
  it("inserts a full multi-line paste payload into the prompt, newlines preserved", async () => {
    const app = await mountApp();
    try {
      await app.send(
        `${PASTE_START}SELECT *\nFROM users\nWHERE id = 1${PASTE_END}`,
      );
      const out = app.output();
      expect(out).toContain("SELECT *");
      expect(out).toContain("FROM users");
      expect(out).toContain("WHERE id = 1");
    } finally {
      await app.cleanup();
    }
  });

  it("does not open autocomplete, palette, or reverse-search while pasting", async () => {
    const app = await mountApp();
    try {
      await app.send(`${PASTE_START}sel${PASTE_END}`);
      const out = app.output();
      expect(out).toContain("> sel");
      expect(out).not.toContain("(reverse-i-search)");
    } finally {
      await app.cleanup();
    }
  });

  it("non-pasted Enter still submits a query", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT 42 AS answer");
      await app.send("\r");
      const out = app.output();
      expect(out).toContain("42");
      expect(out).toContain("answer");
    } finally {
      await app.cleanup();
    }
  });
});
