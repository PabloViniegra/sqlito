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

const frameLines = (frame: string): number =>
  frame.replace(/\n+$/, "").split("\n").length;

async function mountSeededApp(columns: number, rows: number) {
  const driver = new BetterSqlite3(":memory:");
  driver.exec("CREATE TABLE nums (id INTEGER, label TEXT);");
  const insert = driver.prepare("INSERT INTO nums VALUES (?, ?)");
  for (let i = 0; i < 200; i += 1) insert.run(i, `label for row ${i}`);
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
    stdout,
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

function expectAllFramesWithin(stdout: FakeStdout): void {
  for (const frame of stdout.frames) {
    expect(frameLines(frame)).toBeLessThanOrEqual(stdout.rows);
  }
}

describe("App frame height discipline", () => {
  it("keeps every frame within 80x24 for a 200-row SELECT and truncates the table", async () => {
    const app = await mountSeededApp(80, 24);
    try {
      await app.send("SELECT * FROM nums");
      await app.send(ENTER);

      expectAllFramesWithin(app.stdout);
      const last = app.lastFrame();
      expect(last).toContain("… +");
      expect(last).toContain("more rows");
      expect(last).toContain("▌");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps every frame within 80x24 across a mixed-query session", async () => {
    const app = await mountSeededApp(80, 24);
    try {
      const session = [
        "SELECT * FROM nums",
        "INSERT INTO nums VALUES (999, 'x')",
        "UPDATE nums SET label = 'y' WHERE id = 999",
        "SELECT id FROM nums WHERE id > 190",
        "DELETE FROM nums WHERE id = 999",
        "SELECT count(*) FROM nums",
        "CREATE TABLE extra (id INTEGER)",
        "SELECT * FROM nums WHERE id < 50",
      ];
      for (const sql of session) {
        await app.send(sql);
        await app.send(ENTER);
      }

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("▌");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps every frame within a tiny 80x10 terminal with the prompt visible", async () => {
    const app = await mountSeededApp(80, 10);
    try {
      await app.send("SELECT * FROM nums");
      await app.send(ENTER);

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("▌");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps every frame within 80x24 while typing a 200-char prompt", async () => {
    const app = await mountSeededApp(80, 24);
    try {
      await app.send("SELECT * FROM nums");
      await app.send(ENTER);
      await app.send(`SELECT '${"x".repeat(200)}'`);

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("▌");
    } finally {
      await app.cleanup();
    }
  });
});
