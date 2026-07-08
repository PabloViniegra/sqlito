import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { render } from "ink";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";

const UP = "\u001B[A";
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

async function mountApp() {
  const driver = new BetterSqlite3(":memory:");
  const db = BetterSqliteDatabase.withDriver(driver);
  const schema = new SqliteSchemaRepository(driver);
  const stdout = fakeStdout(80, 30);
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
    output: () => stripAnsi(stdout.buffer).replace(/\r/g, ""),
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

function lastPromptLine(out: string): string {
  return (
    out
      .split("\n")
      .filter((l) => l.includes(">"))
      .pop() ?? ""
  );
}

describe("App ↑ recall-and-retry on recent failure", () => {
  it("rehydrates the failed SQL into the prompt on ↑ when the prompt is empty", async () => {
    const app = await mountApp();
    try {
      const BAD_SQL = "SELECT from nonexistent";
      await app.send(BAD_SQL);
      await app.send(ENTER);

      const afterFailure = app.output();
      expect(afterFailure).toContain("ERROR");
      expect(afterFailure).toContain("syntax error");
      expect(lastPromptLine(afterFailure).trim()).toMatch(/^>(\s*)\u258C?$/);

      await app.send(UP);

      const afterRecall = app.output();
      const promptLine = lastPromptLine(afterRecall);
      expect(promptLine).toContain("SELECT from nonexistent");
      expect(promptLine).toMatch(/SELECT from nonexistent\s*\u258C$/);
    } finally {
      await app.cleanup();
    }
  });

  it("a successful query clears the ref so ↑ falls back to history recall", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT from nonexistent");
      await app.send(ENTER);
      const afterFailure = app.output();
      expect(afterFailure).toContain("ERROR");

      await app.send("SELECT 1");
      await app.send(ENTER);
      const afterSuccess = app.output();
      expect(afterSuccess).toContain("1");

      await app.send(UP);

      const afterRecall = app.output();
      const promptLine = lastPromptLine(afterRecall);
      expect(promptLine).not.toContain("SELECT from nonexistent");
      expect(promptLine).toContain("SELECT 1");
    } finally {
      await app.cleanup();
    }
  });

  it("does not recall on ↑ when the prompt is not empty (history recall takes over)", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT 7 AS lucky");
      await app.send(ENTER);
      const afterFirst = app.output();
      expect(afterFirst).toContain("lucky");

      await app.send("SELECT from nonexistent");
      await app.send(ENTER);
      const afterFailure = app.output();
      expect(afterFailure).toContain("ERROR");

      await app.send("dra");
      await app.send(UP);

      const afterRecall = app.output();
      const promptLine = lastPromptLine(afterRecall);
      expect(promptLine).not.toContain("SELECT from nonexistent");
    } finally {
      await app.cleanup();
    }
  });

  it("the user can edit the recalled SQL and re-submit (success path)", async () => {
    const app = await mountApp();
    try {
      await app.send("SELECT from nonexistent");
      await app.send(ENTER);
      const afterFailure = app.output();
      expect(afterFailure).toContain("ERROR");

      await app.send(UP);
      const afterRecall = app.output();
      expect(lastPromptLine(afterRecall)).toContain("SELECT from nonexistent");

      await app.send("\u0015");
      await app.send("SELECT 42");
      await app.send(ENTER);
      const afterRerun = app.output();
      expect(afterRerun).toContain("42");
    } finally {
      await app.cleanup();
    }
  });
});
