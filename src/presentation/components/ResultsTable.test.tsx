import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { renderInkFrame as captureRaw } from "./renderInkFrame.ts";
import { ResultsTable } from "./ResultsTable.tsx";

chalk.level = 1;

async function capture(
  node: React.ReactElement,
  options: { columns?: number } = {},
): Promise<string> {
  return stripAnsi(await captureRaw(node, options)).replace(/\r/g, "");
}

describe("ResultsTable", () => {
  it("renders rows outcome with a framed table that includes header and rows", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [
        { name: "id", type: null },
        { name: "name", type: null },
      ],
      rows: [
        [1, "Ada"],
        [2, "Lin"],
      ],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT id, name FROM t"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("id");
    expect(frame).toContain("name");
    expect(frame).toContain("Ada");
    expect(frame).toContain("Lin");
    expect(frame).toContain("SELECT");
    expect(frame).toContain("2 rows");
    expect(frame).toContain("╭");
    expect(frame).toContain("╰");
    expect(frame).toContain("│");
    expect(
      frame.split("\n").filter((l) => l.length > 0).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("renders affected outcome with row count and last insert rowid in the footer", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 1,
      lastInsertRowid: 42,
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="INSERT INTO t VALUES (1)"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("1 rows affected");
    expect(frame).toContain("last insert rowid: 42");
  });

  it("omits the rowid parenthetical from the footer when lastInsertRowid is zero", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 0,
      lastInsertRowid: 0n,
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="CREATE TABLE x (id INT)"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("0 rows affected");
    expect(frame).not.toContain("last insert rowid");
  });

  it("renders side-effect outcome as 'done' with no row count or rowid", async () => {
    const outcome: QueryOutcome = { kind: "side-effect" };

    const frame = await capture(
      <ResultsTable outcome={outcome} sql="VACUUM" theme={DEFAULT_THEME} />,
    );

    expect(frame).toContain("VACUUM");
    expect(frame).toContain("done");
    expect(frame).not.toContain("rows affected");
    expect(frame).not.toContain("last insert rowid");
  });

  it("renders error outcome with the SQLite message", async () => {
    const outcome: QueryOutcome = {
      kind: "error",
      message: 'near "syntax": syntax error',
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT syntax"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain('near "syntax": syntax error');
  });

  it("renders NULL cells as the literal string NULL", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [
        { name: "id", type: null },
        { name: "name", type: null },
      ],
      rows: [
        [1, null],
        [2, undefined],
      ],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT id, name FROM t"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("NULL");
    expect(frame).not.toContain("undefined");
  });

  it("renders bigint rowids as their numeric string", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "rowid", type: null }],
      rows: [[42n]],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT rowid FROM t"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("42");
  });

  it("truncates long cell values to fit the rendered width", async () => {
    const longValue =
      "this string is intentionally much longer than the column width";
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "v", type: null }],
      rows: [[longValue]],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT v FROM t"
        theme={DEFAULT_THEME}
      />,
      { columns: 20 },
    );

    expect(frame).toContain("…");
    expect(frame).not.toContain(longValue);
  });

  it("renders plan outcome as an indented tree", async () => {
    const outcome: QueryOutcome = {
      kind: "plan",
      nodes: [
        {
          id: 1,
          parent: 0,
          detail: "SCAN users",
          depth: 0,
          children: [
            {
              id: 2,
              parent: 1,
              detail: "USE TEMP B-TREE FOR ORDER BY",
              depth: 1,
              children: [],
            },
          ],
        },
      ],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="EXPLAIN QUERY PLAN SELECT * FROM users ORDER BY name"
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("PLAN");
    expect(frame).toContain("SCAN users");
    expect(frame).toContain("USE TEMP B-TREE FOR ORDER BY");
    const lines = frame.split("\n");
    const rootLine = lines.find((l) => l.includes("SCAN users"))!;
    const childLine = lines.find((l) =>
      l.includes("USE TEMP B-TREE FOR ORDER BY"),
    )!;
    expect(childLine.indexOf("USE TEMP B-TREE")).toBeGreaterThan(
      rootLine.indexOf("SCAN users"),
    );
  });

  it("renders the side-effect body in the theme's muted color", async () => {
    const outcome: QueryOutcome = { kind: "side-effect" };

    const frame = await captureRaw(
      <ResultsTable
        outcome={outcome}
        sql="VACUUM"
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toContain(chalk.gray("done"));
  });

  it("renders error messages in the theme's error color", async () => {
    const outcome: QueryOutcome = { kind: "error", message: "boom" };

    const frame = await captureRaw(
      <ResultsTable
        outcome={outcome}
        sql="SELECT 1"
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toContain(chalk.redBright("boom"));
    expect(frame).not.toContain(chalk.red("boom"));
  });
});
