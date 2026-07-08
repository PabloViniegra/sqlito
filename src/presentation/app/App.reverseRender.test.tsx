import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const ENTER = "\r";

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

const INSERTS = [
  "INSERT INTO users VALUES (1, 'Ada')",
  "INSERT INTO users VALUES (2, 'B')",
  "INSERT INTO users VALUES (3, 'C')",
  "INSERT INTO users VALUES (4, 'D')",
  "INSERT INTO users VALUES (5, 'E')",
  "INSERT INTO users VALUES (6, 'Frank')",
];

async function mountAppWithUsersTable(columns = 120, rows = 80) {
  const driver = new BetterSqlite3(":memory:");
  driver.exec("CREATE TABLE users (id INTEGER, name TEXT);");
  const db = BetterSqliteDatabase.withDriver(driver);
  const schema = new SqliteSchemaRepository(driver);
  const stdout = fakeStdout(columns, rows);
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

describe("App pastQueries reverse render order", () => {
  it("renders the newest query above the older ones so Ink never clips it", async () => {
    const app = await mountAppWithUsersTable();
    try {
      for (const sql of INSERTS) {
        await app.send(sql);
        await app.send(ENTER);
      }

      const out = app.output();
      expect(out).toContain("INSERT INTO users VALUES (6, 'Frank')");
      expect(out).toContain("INSERT INTO users VALUES (1, 'Ada')");

      const frankPos = out.lastIndexOf("Frank");
      const bPos = out.lastIndexOf("'B'");
      expect(frankPos).toBeGreaterThan(-1);
      expect(bPos).toBeGreaterThan(-1);
      expect(frankPos).toBeLessThan(bPos);
    } finally {
      await app.cleanup();
    }
  });
});
