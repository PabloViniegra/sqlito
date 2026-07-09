import chalk from "chalk";
import { PassThrough } from "node:stream";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { render } from "ink";
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
  it("prepends READ to rows headers", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "1", type: null }],
      rows: [[1]],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT 1"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("READ SELECT · 1 rows · SELECT 1");
  });

  it("reports hidden columns in the header when they cannot fit", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: Array.from({ length: 12 }, (_, i) => ({
        name: `column_${i}`,
        type: null,
      })),
      rows: [Array.from({ length: 12 }, (_, i) => `value ${i}`)],
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT * FROM wide"
        theme={DEFAULT_THEME}
        columns={60}
      />,
      { columns: 60 },
    );

    expect(frame).toContain("+4 more cols");
  });

  it("prepends WRITE to affected headers", async () => {
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
        columns={80}
      />,
    );

    expect(frame).toContain("WRITE INSERT");
  });

  it("prepends DDL to side-effect headers", async () => {
    const outcome: QueryOutcome = { kind: "side-effect" };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="VACUUM"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("DDL VACUUM");
    expect(frame).toContain("DDL VACUUM · side effect");
  });

  it("uses ERROR and PLAN tags as the header keyword", async () => {
    const planOutcome: QueryOutcome = {
      kind: "plan",
      nodes: [
        {
          id: 1,
          parent: 0,
          detail: "SCAN users",
          depth: 0,
          children: [],
        },
      ],
    };
    const errorOutcome: QueryOutcome = {
      kind: "error",
      message: "boom",
    };

    const planFrame = await capture(
      <ResultsTable
        outcome={planOutcome}
        sql="EXPLAIN QUERY PLAN SELECT * FROM users"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );
    const errorFrame = await capture(
      <ResultsTable
        outcome={errorOutcome}
        sql="SELECT 1"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(planFrame).toContain("PLAN · 1 node");
    expect(planFrame).not.toMatch(/PLAN\s+PLAN/);
    expect(errorFrame).toContain("ERROR · aborted");
    expect(errorFrame).not.toMatch(/ERROR\s+ERROR/);
  });

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
        columns={80}
      />,
    );

    expect(frame).toContain("id");
    expect(frame).toContain("name");
    expect(frame).toContain("Ada");
    expect(frame).toContain("Lin");
    expect(frame).toContain("SELECT");
    expect(frame).toContain("2 rows");
    expect(frame).toContain("+");
    expect(frame).toContain("|");
    expect(frame).toContain("-");
    expect(
      frame.split("\n").filter((l) => l.length > 0).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it("renders a prominent ✓ line with row count and rowid for affected outcomes", async () => {
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
        columns={80}
      />,
    );

    expect(frame).toContain("1 rows affected");
    expect(frame).toContain("✓ INSERT OK · 1 rows · rowid 42");
  });

  it("renders 0 rows matched for affected outcomes with zero changes", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 0,
      lastInsertRowid: 0,
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="UPDATE users SET name = 'Ada' WHERE id = 999"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("0 rows affected");
    expect(frame).toContain("✓ UPDATE OK · 0 rows matched");
    expect(frame).not.toContain("rowid");
  });

  it("keeps the rowid segment for INSERTs with zero changes and a positive rowid", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 0,
      lastInsertRowid: 42,
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="INSERT OR IGNORE INTO users VALUES (1, 'Ada')"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("0 rows matched");
    expect(frame).toContain("rowid 42");
  });

  it("omits the connection-level stale rowid for non-INSERT writes", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 2,
      lastInsertRowid: 42,
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="UPDATE users SET name = 'Ada' WHERE id <= 2"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("✓ UPDATE OK · 2 rows");
    expect(frame).not.toContain("rowid");
  });

  it("renders a ✓ footer with rows returned for write-flagged rows outcomes (RETURNING)", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "id", type: null }],
      rows: [[1], [2]],
      writes: true,
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="INSERT INTO t VALUES (1), (2) RETURNING id"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("WRITE INSERT");
    expect(frame).toContain("✓ INSERT OK · 2 rows returned");
  });

  it("renders side-effect outcome as 'done' with no row count or rowid", async () => {
    const outcome: QueryOutcome = { kind: "side-effect" };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="VACUUM"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("VACUUM");
    expect(frame).toContain("done");
    expect(frame).not.toContain("rows affected");
    expect(frame).not.toContain("rowid");
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
        columns={80}
      />,
    );

    expect(frame).toContain('near "syntax": syntax error');
  });

  it("renders error outcome with the SQLite code on its own line above the message", async () => {
    const outcome: QueryOutcome = {
      kind: "error",
      code: "SQLITE_CONSTRAINT",
      message: "UNIQUE constraint failed: t.id",
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="INSERT INTO t VALUES (1)"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("SQLITE_CONSTRAINT");
    expect(frame).toContain("UNIQUE constraint failed: t.id");
    const codeIndex = frame.indexOf("SQLITE_CONSTRAINT");
    const messageIndex = frame.indexOf("UNIQUE constraint failed: t.id");
    expect(codeIndex).toBeLessThan(messageIndex);
  });

  it("renders error outcome without a code showing only the message", async () => {
    const outcome: QueryOutcome = {
      kind: "error",
      message: "boom",
    };

    const frame = await capture(
      <ResultsTable
        outcome={outcome}
        sql="SELECT 1"
        theme={DEFAULT_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain("boom");
    expect(frame).not.toMatch(/SQLITE_/);
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
        columns={80}
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
        columns={80}
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
        columns={20}
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
        columns={80}
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
        columns={80}
      />,
    );

    expect(frame).toContain(chalk.gray("done"));
  });

  it("renders WRITE tags in the high-contrast write color", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 0,
      lastInsertRowid: 0,
    };

    const frame = await captureRaw(
      <ResultsTable
        outcome={outcome}
        sql="UPDATE users SET name = 'Ada' WHERE id = 999"
        theme={HIGH_CONTRAST_THEME}
        columns={80}
      />,
    );

    const escape = "\u001B[";
    expect(frame).toContain(`${escape}33mWRITE`);
    expect(frame).not.toContain(`${escape}93mWRITE`);
  });

  it("renders error messages in the theme's error color", async () => {
    const outcome: QueryOutcome = { kind: "error", message: "boom" };

    const frame = await captureRaw(
      <ResultsTable
        outcome={outcome}
        sql="SELECT 1"
        theme={HIGH_CONTRAST_THEME}
        columns={80}
      />,
    );

    expect(frame).toContain(chalk.redBright("boom"));
    expect(frame).not.toContain(chalk.red("boom"));
  });

  it("reflows the table width when the columns prop changes", async () => {
    // Resize-reactivity now lives in App.tsx's single useViewportSize() call
    // and flows down as a prop, so this drives it via rerender rather than a
    // stdout "resize" event (ResultsTable no longer listens for one itself).
    type FakeTty = NodeJS.WriteStream & {
      columns: number;
      rows: number;
      isTTY: boolean;
      buffer: string;
    };
    const tty = new PassThrough() as unknown as FakeTty;
    tty.columns = 20;
    tty.rows = 24;
    tty.isTTY = true;
    tty.buffer = "";
    tty.write = (chunk: string | Uint8Array): boolean => {
      tty.buffer += chunk.toString();
      return true;
    };

    const longValue =
      "this string is intentionally much longer than the column width";
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "v", type: null }],
      rows: [[longValue]],
    };

    const instance = render(
      <ResultsTable
        outcome={outcome}
        sql="SELECT v"
        theme={DEFAULT_THEME}
        columns={20}
      />,
      {
        stdout: tty as NodeJS.WriteStream,
        exitOnCtrlC: false,
        patchConsole: false,
      },
    );
    await new Promise<void>((resolve) => setImmediate(resolve));

    const narrowFrame = stripAnsi(tty.buffer).replace(/\r/g, "");
    expect(narrowFrame).toContain("…");
    expect(narrowFrame).not.toContain(longValue);

    tty.columns = 120;
    instance.rerender(
      <ResultsTable
        outcome={outcome}
        sql="SELECT v"
        theme={DEFAULT_THEME}
        columns={120}
      />,
    );
    // Ink throttles re-renders; a single setImmediate tick can fire before
    // the second frame flushes, so wait long enough for it to land.
    await new Promise<void>((resolve) => setTimeout(resolve, 50));

    const wideFrame = stripAnsi(tty.buffer).replace(/\r/g, "");
    expect(wideFrame).not.toContain("SELECT v…");

    const narrowRules = (narrowFrame.match(/─/g) ?? []).length;
    const wideRules = (wideFrame.match(/─/g) ?? []).length;
    expect(wideRules).toBeGreaterThan(narrowRules);

    instance.unmount();
  });
});
