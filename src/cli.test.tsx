import BetterSqlite3 from "better-sqlite3";
import { describe, expect, it, vi } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { mountApp, run } from "./cli.tsx";
import { BetterSqliteDatabase } from "./infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "./infrastructure/sqlite/SqliteSchemaRepository.ts";
import { fakeStdin, fakeStdout } from "./shared/utils/inkTestStreams.ts";

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

type MemoryDb = {
  driver: BetterSqlite3.Database;
  db: BetterSqliteDatabase;
  schema: SqliteSchemaRepository;
};

function openMemoryDb(): MemoryDb {
  const driver = new BetterSqlite3(":memory:");
  const db = new BetterSqliteDatabase(driver);
  const schema = new SqliteSchemaRepository(db);
  return { driver, db, schema };
}

describe("cli.mountApp", () => {
  it("enters the alternate screen buffer on mount", async () => {
    const { driver, db, schema } = openMemoryDb();
    try {
      const tty = fakeStdout();
      const stdin = fakeStdin();

      const instance = mountApp(
        { db, schema, dbPath: ":memory:" },
        { stdin, stdout: tty, patchConsole: false, interactive: true },
      );
      await nextFrame();

      expect(tty.buffer).toContain("\u001B[?1049h");

      instance.unmount();
      await nextFrame();
    } finally {
      driver.close();
    }
  });

  it("exits the alternate screen buffer on unmount and shows the cursor", async () => {
    const { driver, db, schema } = openMemoryDb();
    try {
      const tty = fakeStdout();
      const stdin = fakeStdin();

      const instance = mountApp(
        { db, schema, dbPath: ":memory:" },
        { stdin, stdout: tty, patchConsole: false, interactive: true },
      );
      await nextFrame();

      instance.unmount();
      await nextFrame();

      expect(tty.buffer).toContain("\u001B[?1049l");
      expect(tty.buffer).toContain("\u001B[?25h");
    } finally {
      driver.close();
    }
  });
});

describe("cli.run", () => {
  it("writes a friendly error and exits when the database file is missing", () => {
    const stderrBuffer: string[] = [];
    const stderrSpy = vi
      .spyOn(process.stderr, "write")
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stderrBuffer.push(chunk.toString());
        return true;
      });
    // SAFETY: vi.fn() returns a generic mock function; we narrow it to process.exit's signature so the spy type-checks against the real API.
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((): never => {
      throw new Error("__process_exit__");
    }) as typeof process.exit);

    try {
      expect(() => run(["node", "sqlito", "/nope/missing.db"])).toThrow(
        "__process_exit__",
      );
      expect(stderrBuffer.join("")).toMatch(/cannot open database/);
    } finally {
      stderrSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });

  it("prints the package version and exits when --version is passed", () => {
    const stdoutBuffer: string[] = [];
    const stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation((chunk: string | Uint8Array): boolean => {
        stdoutBuffer.push(chunk.toString());
        return true;
      });
    // SAFETY: vi.fn() returns a generic mock function; we narrow it to process.exit's signature so the spy type-checks against the real API.
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(((): never => {
      throw new Error("__process_exit__");
    }) as typeof process.exit);

    try {
      expect(() => run(["node", "sqlito", "--version"])).toThrow(
        "__process_exit__",
      );
      expect(stdoutBuffer.join("")).toBe(`${pkg.version}\n`);
    } finally {
      stdoutSpy.mockRestore();
      exitSpy.mockRestore();
    }
  });
});
