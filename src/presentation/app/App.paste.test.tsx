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
  // SAFETY: PassThrough is duck-typed with NodeJS.WriteStream at runtime; this test fixture mutates isTTY/columns/rows/buffer/write before Ink consumes it.
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
  // SAFETY: PassThrough is duck-typed with NodeJS.ReadStream at runtime; this test fixture mutates isTTY/setRawMode/ref/unref before Ink consumes it.
  const stream = new PassThrough() as unknown as FakeStdin;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}

async function waitFor(
  read: () => string,
  predicate: (out: string) => boolean,
  timeoutMs = 500,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const out = read();
    if (predicate(out)) return out;
    await settle();
  }
  return read();
}

async function mountApp() {
  const driver = new BetterSqlite3(":memory:");
  const db = BetterSqliteDatabase.withDriver(driver);
  const schema = new SqliteSchemaRepository(driver);
  const stdout = fakeStdout(80, 24);
  const stdin = fakeStdin();
  // SAFETY: Ink's render accepts Node streams; FakeStdin/FakeStdout satisfy that surface at runtime after the fixture mutations above.
  const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
    interactive: true,
  });
  await settle();
  const read = (): string => stripAnsi(stdout.buffer).replace(/\r/g, "");
  return {
    output: read,
    async send(data: string) {
      stdin.write(data);
      await settle();
    },
    waitFor: (predicate: (out: string) => boolean, timeoutMs?: number) =>
      waitFor(read, predicate, timeoutMs),
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
      const out = await app.waitFor((s) => s.includes("WHERE id = 1"));
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
      const out = await app.waitFor((s) => s.includes("> sel"));
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
      const out = await app.waitFor((s) => s.includes("42"));
      expect(out).toContain("42");
      expect(out).toContain("answer");
    } finally {
      await app.cleanup();
    }
  });
});
