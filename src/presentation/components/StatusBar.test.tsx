import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "../../domain/theme/Theme.ts";
import { StatusBar } from "./StatusBar.tsx";
import { renderInkFrame as capture } from "./renderInkFrame.ts";

chalk.level = 1;

function plain(frame: string): string {
  return stripAnsi(frame).replace(/\r/g, "");
}

const baseProps = {
  dbPath: "db.sqlite",
  theme: DEFAULT_THEME,
  statusMessage: null,
  historyCount: 0,
  favoritesCount: 0,
  columns: 80,
  lastOutcome: null,
} as const;

describe("StatusBar", () => {
  it("renders the db path on the status line", async () => {
    const frame = await capture(<StatusBar {...baseProps} />);

    const output = plain(frame);
    expect(output).toContain("db.sqlite");
  });

  it("renders the history and favorites counters", async () => {
    const frame = await capture(
      <StatusBar {...baseProps} historyCount={347} favoritesCount={4} />,
    );

    const output = plain(frame);
    expect(output).toContain("347 history");
    expect(output).toContain("4 favorites");
  });

  it("renders the info status message", async () => {
    const frame = await capture(
      <StatusBar {...baseProps} statusMessage={{ text: "ok", kind: "info" }} />,
    );

    const output = plain(frame);
    expect(output).toContain("ok");
  });

  it("renders an error status message in the theme's error color", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        statusMessage={{ text: "boom", kind: "error" }}
      />,
    );

    expect(frame).toContain(chalk.red("boom"));
  });

  it("does not color the info status message", async () => {
    const frame = await capture(
      <StatusBar {...baseProps} statusMessage={{ text: "ok", kind: "info" }} />,
    );

    expect(frame).not.toContain(chalk.red("ok"));
    expect(plain(frame)).toContain("ok");
  });

  it("does not render a chip when lastOutcome is null", async () => {
    const frame = await capture(<StatusBar {...baseProps} />);

    const output = plain(frame);
    expect(output).not.toContain("READ");
    expect(output).not.toContain("WRITE");
    expect(output).not.toContain("DDL");
    expect(output).not.toContain("PLAN");
    expect(output).not.toContain("ERROR");
  });

  it("renders READ <N> for a rows outcome", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{
          kind: "rows",
          columns: [{ name: "a", type: null }],
          rows: [[1], [2]],
        }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("READ 2");
  });

  it("renders WRITE <N> for an affected outcome", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{ kind: "affected", changes: 3, lastInsertRowid: 7 }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("WRITE 3");
  });

  it("renders WRITE 0 no-match when changes is zero", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{ kind: "affected", changes: 0, lastInsertRowid: 0 }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("WRITE 0 no-match");
  });

  it("renders DDL for a side-effect outcome", async () => {
    const frame = await capture(
      <StatusBar {...baseProps} lastOutcome={{ kind: "side-effect" }} />,
    );

    const output = plain(frame);
    expect(output).toContain("DDL");
  });

  it("renders PLAN <N> for a plan outcome (top-level node count)", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{
          kind: "plan",
          nodes: [
            {
              id: 1,
              parent: 0,
              detail: "x",
              depth: 0,
              children: [],
            },
            {
              id: 2,
              parent: 0,
              detail: "y",
              depth: 0,
              children: [],
            },
          ],
        }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("PLAN 2");
  });

  it("renders ERROR <code> when code is present and message is long", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{
          kind: "error",
          code: "SQLITE_CONSTRAINT",
          message: "x".repeat(40),
        }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("ERROR SQLITE_CONSTRAINT");
    expect(output).not.toContain(":");
  });

  it("renders ERROR <code>: <message> when message is short (<30 chars)", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{
          kind: "error",
          code: "SQLITE_CONSTRAINT",
          message: "unique violation",
        }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("ERROR SQLITE_CONSTRAINT: unique violation");
  });

  it("renders bare ERROR when there is no code", async () => {
    const frame = await capture(
      <StatusBar
        {...baseProps}
        lastOutcome={{ kind: "error", message: "boom" }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("ERROR");
    expect(output).not.toContain("ERROR SQLITE");
    expect(output).not.toContain("ERROR :");
  });
});
