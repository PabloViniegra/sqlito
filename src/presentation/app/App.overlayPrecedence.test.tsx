import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const TAB = "\t";
const ESC = "\u001B";
const ENTER = "\r";

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

describe("App overlay precedence", () => {
  it("routes a keypress to the open overlay without the prompt swallowing a duplicate", async () => {
    const app = await mountApp();
    try {
      await app.send(TAB);
      await app.send("z");
      const out = app.output();
      expect(out).toContain("> z");
      expect(out).not.toContain("zz");
    } finally {
      await app.cleanup();
    }
  });

  it("Esc closes the overlay so the prompt regains focus and Enter submits", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT 7 AS lucky");
      await app.send(TAB);
      await app.send(ESC);
      await app.send(ENTER);
      const out = app.output();
      expect(out).toContain("lucky");
      expect(out).toContain("7");
    } finally {
      await app.cleanup();
    }
  });
});
