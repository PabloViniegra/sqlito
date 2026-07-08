import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { rm } from "node:fs/promises";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const ESC = "\u001B";
const UP = `${ESC}[A`;
const TAB = "\t";
const ENTER = "\r";
const SETTLE_MS = 30;
const XDG_DIR = "/tmp/sqlito-smoke-test-nonexistent";
const ORIGINAL_XDG_DATA_HOME = process.env.XDG_DATA_HOME;

const tick = () => new Promise<void>((r) => setImmediate(r));
const settle = () => new Promise<void>((r) => setTimeout(r, SETTLE_MS));

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
  });
  await settle();
  let lastSeen = 0;
  return {
    fullOutput: () => stripAnsi(stdout.buffer).replace(/\r/g, ""),
    delta: () => {
      const all = stripAnsi(stdout.buffer).replace(/\r/g, "");
      const fresh = all.slice(lastSeen);
      lastSeen = all.length;
      return fresh;
    },
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

const LONG_SQL =
  "SELECT a_long_column FROM a_long_table WHERE a_long_predicate = 'x' OR another_long_predicate LIKE '%y%';";

describe("App end-to-end smoke (v1.1 slice-11)", () => {
  beforeEach(async () => {
    process.env.XDG_DATA_HOME = XDG_DIR;
    await rm(XDG_DIR, { recursive: true, force: true });
  });
  afterEach(async () => {
    if (ORIGINAL_XDG_DATA_HOME === undefined) {
      delete process.env.XDG_DATA_HOME;
    } else {
      process.env.XDG_DATA_HOME = ORIGINAL_XDG_DATA_HOME;
    }
    await rm(XDG_DIR, { recursive: true, force: true });
  });
  it("drives the full fluidity key sequence: submit, autocomplete, wrap, recall, submit", async () => {
    const app = await mountApp(80, 24);
    try {
      await app.send("SELECT 1;");
      await app.send(ENTER);
      const afterFirstSubmit = app.fullOutput();
      expect(afterFirstSubmit).toContain("SELECT 1");
      expect(afterFirstSubmit).toContain("1 row");

      await app.send(TAB);
      const afterTabDelta = app.delta();
      expect(afterTabDelta).toContain("COMPLETE");

      await app.send(ESC);
      const afterEscDelta = app.delta();
      expect(afterEscDelta).not.toContain("↑↓ move");
      expect(afterEscDelta).not.toContain("COMPLETE");

      await app.send(LONG_SQL);
      const afterLongTypeDelta = app.delta();
      const anotherIdx = afterLongTypeDelta.lastIndexOf("another");
      const hasWrap =
        anotherIdx >= 0 &&
        afterLongTypeDelta
          .slice(anotherIdx)
          .split("\n")[1]
          ?.includes("_long_predicate");
      expect(hasWrap).toBe(true);

      for (let i = 0; i < 6; i++) await app.send(UP);
      const afterRecallDelta = app.delta();
      expect(afterRecallDelta).toContain("SELECT 1;");

      await app.send(ENTER);
      const afterSecondSubmit = app.fullOutput();
      const rowMentions = afterSecondSubmit.match(/\d+ rows?/g) ?? [];
      expect(rowMentions.length).toBeGreaterThanOrEqual(2);

      const promptLinesAfter = afterSecondSubmit.split("\n");
      const lastPromptLine =
        promptLinesAfter.filter((l) => l.trim().startsWith(">")).pop() ?? "";
      const ANSI = String.fromCharCode(0x1b);
      expect(
        lastPromptLine.replace(new RegExp(`${ANSI}\\[.*?m`, "g"), "").trim(),
      ).toMatch(/^>\s*\u258C?\s*$/);
    } finally {
      await app.cleanup();
    }
  });
});
