import { describe, expect, it, vi } from "vitest";
import { HELP_TEXT } from "../../application/commands/helpText.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { handleDotCommand, type DotCommandDeps } from "./dotCommand.ts";
import type { StatusMessage } from "./appReducer.ts";

type Captured = { status: StatusMessage | null }[];

function makeDeps(overrides: Partial<DotCommandDeps> = {}): {
  deps: DotCommandDeps;
  events: Captured;
} {
  const events: Captured = [];
  const deps: DotCommandDeps = {
    dispatch: (event) => events.push({ status: event.status }),
    exportCsv: { run: vi.fn() } as unknown as DotCommandDeps["exportCsv"],
    schema: {
      tables: () => "posts\nusers",
      indexes: () => "idx on users",
      schema: (name?: string) =>
        name === "ghost"
          ? { ok: false, error: "unknown table: ghost" }
          : { ok: true, text: "CREATE TABLE users (...);" },
    } as unknown as DotCommandDeps["schema"],
    lastRowsOutcome: null,
    onQuit: vi.fn(),
    ...overrides,
  };
  return { deps, events };
}

describe("handleDotCommand", () => {
  it("reports parse errors as an error status", async () => {
    const { deps, events } = makeDeps();
    await handleDotCommand(".nope", deps);
    expect(events).toEqual([
      { status: { text: "unknown command: .nope", kind: "error" } },
    ]);
  });

  it(".tables writes the table list as info", async () => {
    const { deps, events } = makeDeps();
    await handleDotCommand(".tables", deps);
    expect(events).toEqual([
      { status: { text: "posts\nusers", kind: "info" } },
    ]);
  });

  it(".indexes writes the index list as info", async () => {
    const { deps, events } = makeDeps();
    await handleDotCommand(".indexes", deps);
    expect(events).toEqual([
      { status: { text: "idx on users", kind: "info" } },
    ]);
  });

  it(".schema users writes the schema as info", async () => {
    const { deps, events } = makeDeps();
    await handleDotCommand(".schema users", deps);
    expect(events).toEqual([
      { status: { text: "CREATE TABLE users (...);", kind: "info" } },
    ]);
  });

  it(".schema ghost writes an error status", async () => {
    const { deps, events } = makeDeps();
    await handleDotCommand(".schema ghost", deps);
    expect(events).toEqual([
      { status: { text: "unknown table: ghost", kind: "error" } },
    ]);
  });

  it(".help writes the help reference as info", async () => {
    const { deps, events } = makeDeps();
    await handleDotCommand(".help", deps);
    expect(events).toEqual([{ status: { text: HELP_TEXT, kind: "info" } }]);
  });

  it(".quit invokes the quit callback and does not set status", async () => {
    const onQuit = vi.fn();
    const { deps, events } = makeDeps({ onQuit });
    await handleDotCommand(".quit", deps);
    expect(onQuit).toHaveBeenCalledOnce();
    expect(events).toEqual([]);
  });

  it(".export with no prior result errors", async () => {
    const { deps, events } = makeDeps({ lastRowsOutcome: null });
    await handleDotCommand(".export /tmp/x.csv", deps);
    expect(events).toEqual([
      { status: { text: "No tabular result to export", kind: "error" } },
    ]);
  });

  it(".export runs ExportCsv and reports rows written", async () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [{ name: "a", type: null }],
      rows: [[1]],
    };
    const run = vi
      .fn()
      .mockResolvedValue({ rowsWritten: 1, path: "/tmp/x.csv" });
    const { deps, events } = makeDeps({
      exportCsv: { run } as unknown as DotCommandDeps["exportCsv"],
      lastRowsOutcome: outcome,
    });
    await handleDotCommand(".export /tmp/x.csv", deps);
    expect(run).toHaveBeenCalledWith(outcome, "/tmp/x.csv");
    expect(events).toEqual([
      { status: { text: "Exported 1 rows to /tmp/x.csv", kind: "info" } },
    ]);
  });
});
