import BetterSqlite3 from "better-sqlite3";
import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import pkg from "../package.json" with { type: "json" };
import { mountApp, run } from "./cli.tsx";
import { BetterSqliteDatabase } from "./infrastructure/sqlite/BetterSqliteDatabase.ts";
import { SqliteSchemaRepository } from "./infrastructure/sqlite/SqliteSchemaRepository.ts";

type FakeTty = NodeJS.WriteStream & {
  columns: number;
  isTTY: boolean;
  buffer: string;
};

function fakeTty(): FakeTty {
  const stream = new PassThrough() as unknown as FakeTty;
  stream.columns = 80;
  stream.isTTY = true;
  stream.buffer = "";
  stream.write = (chunk: string | Uint8Array): boolean => {
    stream.buffer += chunk.toString();
    return true;
  };
  return stream;
}

async function nextFrame(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function openMemoryDb(): {
  driver: BetterSqlite3.Database;
  schema: SqliteSchemaRepository;
} {
  const driver = new BetterSqlite3(":memory:");
  const schema = new SqliteSchemaRepository(driver);
  return { driver, schema };
}

describe("cli.mountApp", () => {
  it("enters the alternate screen buffer on mount", async () => {
    const { driver, schema } = openMemoryDb();
    try {
      const db = BetterSqliteDatabase.withDriver(driver);
      const tty = fakeTty();

      const instance = mountApp(
        { db, schema, dbPath: ":memory:" },
        { stdout: tty, patchConsole: false },
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
    const { driver, schema } = openMemoryDb();
    try {
      const db = BetterSqliteDatabase.withDriver(driver);
      const tty = fakeTty();

      const instance = mountApp(
        { db, schema, dbPath: ":memory:" },
        { stdout: tty, patchConsole: false },
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
