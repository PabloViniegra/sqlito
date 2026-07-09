import BetterSqlite3 from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { render } from "ink";

// keep test-session queries out of the user's real XDG history
process.env.XDG_DATA_HOME = mkdtempSync(join(tmpdir(), "sqlito-test-"));
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "sqlito-test-"));
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
  frames: string[];
};

function fakeStdout(columns: number, rows: number): FakeStdout {
  const stream = new PassThrough() as unknown as FakeStdout;
  stream.isTTY = true;
  stream.columns = columns;
  stream.rows = rows;
  stream.frames = [];
  stream.write = (chunk: string | Uint8Array): boolean => {
    const text = stripAnsi(chunk.toString()).replace(/\r/g, "");
    if (text.trim() !== "") stream.frames.push(text);
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

async function mountAppWithUsersTable(columns = 120, rows = 40) {
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
    lastFrame: () => stdout.frames[stdout.frames.length - 1] ?? "",
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

describe("App REPL render order", () => {
  it("renders the newest result at the bottom, directly above the prompt", async () => {
    const app = await mountAppWithUsersTable();
    try {
      for (const sql of INSERTS) {
        await app.send(sql);
        await app.send(ENTER);
      }

      const frame = app.lastFrame();
      const bPos = frame.indexOf("'B'");
      const frankPos = frame.indexOf("Frank");
      const promptPos = frame.indexOf("▌");

      expect(bPos).toBeGreaterThan(-1);
      expect(frankPos).toBeGreaterThan(-1);
      expect(promptPos).toBeGreaterThan(-1);
      // older above, newest below, prompt right after
      expect(bPos).toBeLessThan(frankPos);
      expect(frankPos).toBeLessThan(promptPos);
      // the newest write shows its prominent feedback line next to the prompt
      expect(frame).toContain("✓ INSERT OK · 1 rows · rowid 6");
    } finally {
      await app.cleanup();
    }
  });

  it("renders a failed query as an error card above the prompt, collapsed after the next success", async () => {
    const app = await mountAppWithUsersTable();
    try {
      await app.send("SELECT * FROM missing_table");
      await app.send(ENTER);

      let frame = app.lastFrame();
      expect(frame).toContain("ERROR · aborted");
      expect(frame).toContain("! SQLITE_ERROR");
      expect(frame).toContain("no such table: missing_table");
      // the error card sits above the prompt
      expect(frame.indexOf("no such table")).toBeLessThan(frame.indexOf("▌"));

      await app.send("SELECT * FROM users");
      await app.send(ENTER);

      frame = app.lastFrame();
      // collapsed to its one-line header above the newest result
      const errorLine = frame
        .split("\n")
        .find((l) => l.includes("ERROR · aborted"));
      expect(errorLine).toBeDefined();
      expect(errorLine).toContain("SELECT * FROM missing_table");
      expect(frame).not.toContain("! SQLITE_ERROR");
    } finally {
      await app.cleanup();
    }
  });

  it("collapses older visible entries to one-line summaries", async () => {
    const app = await mountAppWithUsersTable();
    try {
      for (const sql of INSERTS) {
        await app.send(sql);
        await app.send(ENTER);
      }
      await app.send("SELECT * FROM users");
      await app.send(ENTER);

      const frame = app.lastFrame();
      const lines = frame.split("\n");
      // the expanded SELECT card renders a framed table…
      expect(frame).toContain("+----");
      // …while collapsed INSERT entries are single header lines: their line
      // contains the tag + sql and no table borders
      const collapsedLine = lines.find((l) => l.includes("'E'"));
      expect(collapsedLine).toBeDefined();
      expect(collapsedLine).toContain("WRITE INSERT");
      // newest (the SELECT table) sits below the collapsed entries
      const eLine = lines.findIndex((l) => l.includes("'E'"));
      const tableLine = lines.findIndex((l) => l.includes("+----"));
      expect(eLine).toBeLessThan(tableLine);
    } finally {
      await app.cleanup();
    }
  });
});
