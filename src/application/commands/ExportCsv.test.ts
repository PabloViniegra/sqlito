import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
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

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlito-export-"));
    useCase = new ExportCsv();
  });

  afterEach(async () => {
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
      expect(result).toEqual({ rowsWritten: 1, path: dest });
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
      expect(result).toEqual({ rowsWritten: 3, path: dest });
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
      expect(result).toEqual({ rowsWritten: 0, path: dest });
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
});
