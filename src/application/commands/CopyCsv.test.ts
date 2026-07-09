import { describe, expect, it, vi } from "vitest";
import type { Column } from "../../domain/sql/Column.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { CopyCsv, NoTabularOutcome } from "./CopyCsv.ts";

const { write } = vi.hoisted(() => ({ write: vi.fn() }));
vi.mock("clipboardy", () => ({ default: { write } }));

const columns = (names: readonly string[]): readonly Column[] =>
  names.map((name) => ({ name, type: null }));

const rowsOutcome = (
  names: readonly string[],
  rows: readonly unknown[][],
): QueryOutcome => ({ kind: "rows", columns: columns(names), rows });

describe("CopyCsv", () => {
  const useCase = new CopyCsv();

  describe("gating", () => {
    it("throws NoTabularOutcome when outcome is affected", async () => {
      const outcome: QueryOutcome = {
        kind: "affected",
        changes: 1,
        lastInsertRowid: 1,
      };

      await expect(useCase.run(outcome)).rejects.toBeInstanceOf(
        NoTabularOutcome,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it("throws NoTabularOutcome for side-effect outcome", async () => {
      const outcome: QueryOutcome = { kind: "side-effect" };

      await expect(useCase.run(outcome)).rejects.toBeInstanceOf(
        NoTabularOutcome,
      );
      expect(write).not.toHaveBeenCalled();
    });

    it("throws NoTabularOutcome for error outcome", async () => {
      const outcome: QueryOutcome = { kind: "error", message: "boom" };

      await expect(useCase.run(outcome)).rejects.toBeInstanceOf(
        NoTabularOutcome,
      );
      expect(write).not.toHaveBeenCalled();
    });
  });

  describe("golden bytes", () => {
    it("copies a single-column single-row outcome with LF line endings", async () => {
      write.mockClear();

      const result = await useCase.run(rowsOutcome(["a"], [[1]]));

      expect(write).toHaveBeenCalledWith("a\n1\n");
      expect(result).toEqual({ rowsWritten: 1 });
    });

    it("copies headers and rows with mixed primitive types", async () => {
      write.mockClear();

      const result = await useCase.run(
        rowsOutcome(
          ["id", "name", "score"],
          [
            [1, "Ada", 9.5],
            [2, "Lin", null],
            [3, "Mia", true],
          ],
        ),
      );

      expect(write).toHaveBeenCalledWith(
        "id,name,score\n1,Ada,9.5\n2,Lin,\n3,Mia,true\n",
      );
      expect(result).toEqual({ rowsWritten: 3 });
    });

    it("quotes fields containing comma, quote, newline per RFC 4180", async () => {
      write.mockClear();

      await useCase.run(
        rowsOutcome(
          ["a", "b", "c"],
          [["hello, world", 'he said "hi"', "line1\nline2"]],
        ),
      );

      expect(write).toHaveBeenCalledWith(
        'a,b,c\n"hello, world","he said ""hi""","line1\nline2"\n',
      );
    });

    it("returns rowsWritten: 0 and copies header-only CSV when the rows outcome has no rows", async () => {
      write.mockClear();

      const result = await useCase.run(rowsOutcome(["a", "b"], []));

      expect(write).toHaveBeenCalledWith("a,b\n");
      expect(result).toEqual({ rowsWritten: 0 });
    });
  });
});
