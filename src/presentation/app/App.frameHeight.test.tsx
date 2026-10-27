import BetterSqlite3 from "better-sqlite3";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { render } from "ink";
import stringWidth from "string-width";

// keep test-session queries out of the user's real XDG history
process.env.XDG_DATA_HOME = mkdtempSync(join(tmpdir(), "sqlito-test-"));
process.env.XDG_CONFIG_HOME = mkdtempSync(join(tmpdir(), "sqlito-test-"));
import { describe, expect, it } from "vitest";
import { App } from "./App.tsx";
import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "../../infrastructure/sqlite/SqliteSchemaRepository.ts";
import { untilQuiet } from "../../shared/utils/test-helpers.ts";
import {
  fakeStdin,
  fakeStdout,
  type FakeStdout,
} from "../../shared/utils/inkTestStreams.ts";

const ENTER = "\r";

const tick = (): Promise<void> => new Promise((r) => setImmediate(r));
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

const frameLines = (frame: string): number =>
  frame.replace(/\n+$/, "").split("\n").length;

async function mountSeededApp(columns: number, rows: number) {
  const driver = new BetterSqlite3(":memory:");
  driver.exec("CREATE TABLE nums (id INTEGER, label TEXT);");
  const insert = driver.prepare("INSERT INTO nums VALUES (?, ?)");
  for (let i = 0; i < 200; i += 1) insert.run(i, `label for row ${i}`);
  const db = new BetterSqliteDatabase(driver);
  const schema = new SqliteSchemaRepository(db);
  const stdout = fakeStdout(columns, rows);
  const stdin = fakeStdin();
  // SAFETY: Ink's render accepts Node streams; FakeStdin/FakeStdout satisfy that surface at runtime after the fixture mutations above.
  const instance = render(<App db={db} schema={schema} dbPath=":memory:" />, {
    stdin: stdin as NodeJS.ReadStream,
    stdout: stdout as NodeJS.WriteStream,
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
      await untilQuiet(() => stdout.frames.length);
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
    for (const line of frame.split("\n")) {
      expect(stringWidth(line)).toBeLessThanOrEqual(stdout.columns);
    }
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

  it("Tab on the prompt opens autocomplete without inserting a tab character", async () => {
    const app = await mountSeededApp(80, 24);
    try {
      await app.send("SELECT");
      const before = app.lastFrame();
      await app.send("\t");
      await app.send("\x1b");

      expectAllFramesWithin(app.stdout);
      expect(before).toContain("SELECT");
      // After Esc closes autocomplete, the prompt must still read "SELECT"
      // without a stray tab character left behind by the keystroke race.
      expect(app.lastFrame()).toContain("SELECT");
      expect(app.lastFrame()).not.toContain("SELECT\t");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps every frame within a 30-column narrow terminal without overflowing", async () => {
    const app = await mountSeededApp(30, 24);
    try {
      await app.send("SELECT * FROM nums");
      await app.send(ENTER);

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("▌");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps autocomplete within a 30x10 terminal and preserves the prompt", async () => {
    const app = await mountSeededApp(30, 10);
    try {
      await app.send("\t");

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("COMPLETE");
      expect(app.lastFrame()).toContain("▌");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps the command palette within a 30x10 terminal", async () => {
    const app = await mountSeededApp(30, 10);
    try {
      await app.send(String.fromCharCode(0x10));

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("COMMAND");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps a compact command palette within a 30x5 terminal", async () => {
    const app = await mountSeededApp(30, 5);
    try {
      await app.send(String.fromCharCode(0x10));

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("COMMAND");
      expect(app.lastFrame()).not.toContain("▌");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps an active overlay visible in a 30x4 terminal", async () => {
    const app = await mountSeededApp(30, 4);
    try {
      await app.send(String.fromCharCode(0x10));

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("COMMAND");
    } finally {
      await app.cleanup();
    }
  });

  it("keeps the palette visible after a multiline status message", async () => {
    const app = await mountSeededApp(80, 24);
    try {
      await app.send(".help");
      await app.send(ENTER);
      await app.send(String.fromCharCode(0x10));

      expectAllFramesWithin(app.stdout);
      expect(app.lastFrame()).toContain("COMMAND");
    } finally {
      await app.cleanup();
    }
  });
});
