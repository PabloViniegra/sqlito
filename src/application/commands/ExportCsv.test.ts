import { BetterSqliteDatabase } from "../../infrastructure/sqlite/BetterSqliteDatabase.ts";
import {
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Column } from "../../domain/sql/Column.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { ExportCsv, NoTabularOutcome } from "./ExportCsv.ts";

const columns = (names: readonly string[]): readonly Column[] =>
  names.map((name) => ({ name, type: null }));

const rowsOutcome = (
  names: readonly string[],
  rows: readonly unknown[][],
): QueryOutcome => ({ kind: "rows", columns: columns(names), rows });

describe("ExportCsv", () => {
  let dir: string;
  let useCase: ExportCsv;
  let db: BetterSqliteDatabase;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlito-export-"));
    db = new BetterSqliteDatabase(":memory:");
    useCase = new ExportCsv(db);
  });

  afterEach(async () => {
    await db.close();
    await rm(dir, { recursive: true, force: true });
  });

  describe("gating", () => {
    it("throws NoTabularOutcome when outcome is not rows", async () => {
      const outcome: QueryOutcome = {
        kind: "affected",
        changes: 1,
        lastInsertRowid: 1,
      };

      await expect(
        useCase.run(outcome, join(dir, "out.csv")),
      ).rejects.toBeInstanceOf(NoTabularOutcome);
    });

    it("throws NoTabularOutcome for side-effect outcome", async () => {
      const outcome: QueryOutcome = { kind: "side-effect" };

      await expect(
        useCase.run(outcome, join(dir, "out.csv")),
      ).rejects.toBeInstanceOf(NoTabularOutcome);
    });

    it("throws NoTabularOutcome for error outcome", async () => {
      const outcome: QueryOutcome = { kind: "error", message: "boom" };

      await expect(
        useCase.run(outcome, join(dir, "out.csv")),
      ).rejects.toBeInstanceOf(NoTabularOutcome);
    });

    it("does not create a file when outcome is not rows", async () => {
      const dest = join(dir, "out.csv");

      await expect(
        useCase.run({ kind: "side-effect" }, dest),
      ).rejects.toBeInstanceOf(NoTabularOutcome);
      await expect(stat(dest)).rejects.toThrow();
    });
  });

  describe("golden bytes", () => {
    it("writes a single-column single-row outcome with LF line endings", async () => {
      const dest = join(dir, "single.csv");

      const result = await useCase.run(rowsOutcome(["a"], [[1]]), dest);

      const written = await readFile(dest);
      expect(written.equals(Buffer.from("a\n1\n", "utf8"))).toBe(true);
      expect(result).toEqual({ rowsWritten: 1, path: dest, partial: false });
    });

    it("writes headers and rows with mixed primitive types", async () => {
      const dest = join(dir, "mixed.csv");

      const result = await useCase.run(
        rowsOutcome(
          ["id", "name", "score"],
          [
            [1, "Ada", 9.5],
            [2, "Lin", null],
            [3, "Mia", true],
          ],
        ),
        dest,
      );

      const written = await readFile(dest);
      expect(
        written.equals(
          Buffer.from("id,name,score\n1,Ada,9.5\n2,Lin,\n3,Mia,true\n", "utf8"),
        ),
      ).toBe(true);
      expect(result).toEqual({ rowsWritten: 3, path: dest, partial: false });
    });

    it("quotes fields containing comma, quote, newline per RFC 4180", async () => {
      const dest = join(dir, "quotes.csv");

      await useCase.run(
        rowsOutcome(
          ["a", "b", "c"],
          [["hello, world", 'he said "hi"', "line1\nline2"]],
        ),
        dest,
      );

      const written = await readFile(dest);
      expect(
        written.equals(
          Buffer.from(
            'a,b,c\n"hello, world","he said ""hi""","line1\nline2"\n',
            "utf8",
          ),
        ),
      ).toBe(true);
    });

    it("writes CRLF-containing fields with embedded CRLF intact (no extra quoting)", async () => {
      const dest = join(dir, "crlf.csv");

      await useCase.run(rowsOutcome(["v"], [["a\r\nb"]]), dest);

      const written = await readFile(dest);
      expect(written.equals(Buffer.from('v\n"a\r\nb"\n', "utf8"))).toBe(true);
    });

    it("writes unicode unchanged and quotes when needed", async () => {
      const dest = join(dir, "unicode.csv");

      await useCase.run(rowsOutcome(["name"], [["café, 漢字 🚀"]]), dest);

      const written = await readFile(dest);
      expect(
        written.equals(Buffer.from('name\n"café, 漢字 🚀"\n', "utf8")),
      ).toBe(true);
    });

    it("returns rowsWritten: 0 when the rows outcome has no rows", async () => {
      const dest = join(dir, "empty.csv");

      const result = await useCase.run(rowsOutcome(["a", "b"], []), dest);

      const written = await readFile(dest);
      expect(written.equals(Buffer.from("a,b\n", "utf8"))).toBe(true);
      expect(result).toEqual({ rowsWritten: 0, path: dest, partial: false });
    });

    it("produces byte-identical output across two runs of the same outcome", async () => {
      const outcome = rowsOutcome(
        ["id", "name", "note"],
        [
          [1, "Ada", "hello"],
          [2, "Lin", 'a,b "c"'],
          [3, null, "x\ny"],
        ],
      );
      const dest1 = join(dir, "out1.csv");
      const dest2 = join(dir, "out2.csv");

      await useCase.run(outcome, dest1);
      await useCase.run(outcome, dest2);

      const a = await readFile(dest1);
      const b = await readFile(dest2);
      expect(a.equals(b)).toBe(true);
    });

    it("does not emit a BOM byte", async () => {
      const dest = join(dir, "no-bom.csv");

      await useCase.run(rowsOutcome(["a"], [["x"]]), dest);

      const written = await readFile(dest);
      expect(written[0]).not.toBe(0xef);
    });
  });

  describe("filesystem behaviour", () => {
    it("creates parent directories on demand", async () => {
      const dest = join(dir, "deep", "nested", "out.csv");

      await useCase.run(rowsOutcome(["a"], [[1]]), dest);

      const written = await readFile(dest);
      expect(written.equals(Buffer.from("a\n1\n", "utf8"))).toBe(true);
    });

    it("overwrites an existing destination without warning", async () => {
      const dest = join(dir, "existing.csv");

      await useCase.run(rowsOutcome(["a"], [["old"]]), dest);
      await useCase.run(rowsOutcome(["a"], [["new"]]), dest);

      const written = await readFile(dest);
      expect(written.equals(Buffer.from("a\nnew\n", "utf8"))).toBe(true);
    });

    it("returns the absolute destination path it wrote to", async () => {
      const dest = join(dir, "result.csv");

      const result = await useCase.run(rowsOutcome(["a"], [[1]]), dest);

      expect(result.path).toBe(dest);
      expect(result.rowsWritten).toBe(1);
    });
  });

  describe("truncated results", () => {
    const COUNT_SQL =
      "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c LIMIT :n) SELECT x FROM c";

    it("re-runs a truncated read-only query and streams every row", async () => {
      const dest = join(dir, "all.csv");
      const outcome: QueryOutcome = {
        kind: "rows",
        columns: columns(["x"]),
        rows: [[1]],
        truncated: true,
        rerun: { sql: COUNT_SQL, params: { n: 2500 } },
      };

      const result = await useCase.run(outcome, dest);

      expect(result).toEqual({ rowsWritten: 2500, path: dest, partial: false });
      const lines = (await readFile(dest, "utf8")).trimEnd().split("\n");
      expect(lines).toHaveLength(2501);
      expect(lines[0]).toBe("x");
      expect(lines[2500]).toBe("2500");
    });

    it("keeps an existing file when the re-run fails midway", async () => {
      const dest = join(dir, "report.csv");
      await writeFile(dest, "previous export\n");
      const outcome: QueryOutcome = {
        kind: "rows",
        columns: columns(["x"]),
        rows: [[1]],
        truncated: true,
        rerun: {
          // abs() of the minimum integer overflows once row 1500 is reached
          sql: "WITH RECURSIVE c(x) AS (SELECT 1 UNION ALL SELECT x + 1 FROM c LIMIT 2000) SELECT CASE WHEN x = 1500 THEN abs(-9223372036854775808) ELSE x END FROM c",
          params: {},
        },
      };

      await expect(useCase.run(outcome, dest)).rejects.toThrow();

      expect(await readFile(dest, "utf8")).toBe("previous export\n");
      expect(await readdir(dir)).toEqual(["report.csv"]);
    });

    it("writes only the loaded rows of a truncated write statement", async () => {
      const dest = join(dir, "partial.csv");
      const outcome: QueryOutcome = {
        kind: "rows",
        columns: columns(["id"]),
        rows: [[1]],
        writes: true,
        truncated: true,
      };

      const result = await useCase.run(outcome, dest);

      expect(result).toEqual({ rowsWritten: 1, path: dest, partial: true });
    });
  });
});
