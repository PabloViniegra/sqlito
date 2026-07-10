import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const ENTER = "\r";
const PAGE_UP = "\u001B[5~";
const PAGE_DOWN = "\u001B[6~";

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

async function submitMany(
  app: Awaited<ReturnType<typeof mountApp>>,
  n: number,
) {
  for (let i = 1; i <= n; i++) {
    await app.send(`SELECT ${i}`);
    await app.send(ENTER);
  }
}

describe("App pastQueries PgUp/PgDn scroll", () => {
  it("PgUp reveals the indicator with N older queries hidden above", async () => {
    const app = await mountApp(80, 24);
    try {
      await submitMany(app, 11);

      const initial = app.output();
      expect(initial).toContain("↑ 6 more · PgUp");

      await app.send(PAGE_UP);
      const afterPageUp = app.output();
      expect(afterPageUp).toContain("↑ 5 more · PgUp");
    } finally {
      await app.cleanup();
    }
  });

  it("PgDn after PgUp restores the larger overflow count", async () => {
    const app = await mountApp(80, 24);
    try {
      await submitMany(app, 11);

      await app.send(PAGE_UP);
      expect(app.output()).toContain("↑ 5 more · PgUp");

      await app.send(PAGE_DOWN);
      const afterPageDown = app.output();
      expect(afterPageDown).toContain("↑ 6 more · PgUp");
    } finally {
      await app.cleanup();
    }
  });

  it("submitting a new query after PgUp auto-snaps the offset back to 0", async () => {
    const app = await mountApp(80, 24);
    try {
      await submitMany(app, 11);

      await app.send(PAGE_UP);
      expect(app.output()).toContain("↑ 5 more · PgUp");

      await app.send(`SELECT 99`);
      await app.send(ENTER);

      const afterSubmit = app.output();
      expect(afterSubmit).toContain("99");
      expect(afterSubmit).toContain("↑ 7 more · PgUp");
    } finally {
      await app.cleanup();
    }
  });

  it("PgUp and PgDn are no-ops on an empty pastQueries stack", async () => {
    const app = await mountApp(80, 24);
    try {
      await app.send(PAGE_UP);
      await app.send(PAGE_DOWN);

      const out = app.output();
      expect(out).not.toContain("↑");
      expect(out).not.toContain("more · PgUp");
    } finally {
      await app.cleanup();
    }
  });
});
