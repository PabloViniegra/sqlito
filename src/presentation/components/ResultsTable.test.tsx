import { render } from "ink";
import { PassThrough } from "node:stream";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { ResultsTable } from "./ResultsTable.tsx";

async function capture(node: React.ReactElement): Promise<string> {
  const stdout = new PassThrough();
  let buffer = "";
  stdout.write = (chunk: string | Uint8Array): boolean => {
    buffer += chunk.toString();
    return true;
  };
  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  instance.unmount();
  return stripAnsi(buffer).replace(/\r/g, "");
}

describe("ResultsTable", () => {
  it("renders rows outcome with header, separator, and rows", async () => {
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
      <ResultsTable outcome={outcome} sql="SELECT id, name FROM t" />,
    );

    expect(frame).toContain("SELECT id, name FROM t");
    expect(frame).toContain("id");
    expect(frame).toContain("name");
    expect(frame).toContain("Ada");
    expect(frame).toContain("Lin");
    expect(
      frame.split("\n").filter((l) => l.length > 0).length,
    ).toBeGreaterThanOrEqual(4);
  });

  it("renders affected outcome with row count and last insert rowid", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 1,
      lastInsertRowid: 42,
    };

    const frame = await capture(
      <ResultsTable outcome={outcome} sql="INSERT INTO t VALUES (1)" />,
    );

    expect(frame).toContain("INSERT INTO t VALUES (1)");
    expect(frame).toContain("1 rows affected");
    expect(frame).toContain("last insert rowid: 42");
  });

  it("renders affected outcome without rowid parenthetical when lastInsertRowid is zero", async () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 0,
      lastInsertRowid: 0n,
    };

    const frame = await capture(
      <ResultsTable outcome={outcome} sql="CREATE TABLE x (id INT)" />,
    );

    expect(frame).toContain("CREATE TABLE x (id INT)");
    expect(frame).toContain("0 rows affected");
    expect(frame).not.toContain("last insert rowid");
  });

  it("renders error outcome with the SQLite message", async () => {
    const outcome: QueryOutcome = {
      kind: "error",
      message: 'near "syntax": syntax error',
    };

    const frame = await capture(
      <ResultsTable outcome={outcome} sql="SELECT syntax" />,
    );

    expect(frame).toContain("SELECT syntax");
    expect(frame).toContain('near "syntax": syntax error');
  });
});
