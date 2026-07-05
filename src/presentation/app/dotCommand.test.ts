import { describe, expect, it, vi } from "vitest";
import { HELP_TEXT } from "../../application/commands/helpText.ts";
import { SessionVariables } from "../../application/variables/SessionVariables.ts";
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
    dispatch: (event) => {
      if (event.type === "setStatus") events.push({ status: event.status });
    },
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
    sessionVars: new SessionVariables(),
    variables: [],
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

describe("handleDotCommand — variables", () => {
  function makeVarDeps(variables: readonly [string, string][] = []): {
    deps: DotCommandDeps;
    events: unknown[];
    vars: SessionVariables;
  } {
    const events: unknown[] = [];
    const vars = new SessionVariables();
    const deps: DotCommandDeps = {
      dispatch: (event) => events.push(event),
      exportCsv: { run: vi.fn() } as unknown as DotCommandDeps["exportCsv"],
      schema: {} as unknown as DotCommandDeps["schema"],
      lastRowsOutcome: null,
      onQuit: vi.fn(),
      sessionVars: vars,
      variables,
    };
    return { deps, events, vars };
  }

  it(".set stores the variable and dispatches setVariable + info", async () => {
    const { deps, events, vars } = makeVarDeps();
    await handleDotCommand(".set threshold 100", deps);
    expect(vars.entries()).toEqual({ threshold: 100 });
    expect(events).toContainEqual({
      type: "setVariable",
      name: "threshold",
      raw: "100",
    });
    expect(events).toContainEqual({
      type: "setStatus",
      status: { text: "set :threshold = 100", kind: "info" },
    });
  });

  it(".set with an invalid name reports an error and stores nothing", async () => {
    const { deps, events, vars } = makeVarDeps();
    await handleDotCommand(".set 1bad x", deps);
    expect(vars.entries()).toEqual({});
    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: "invalid variable name: 1bad", kind: "error" },
      },
    ]);
  });

  it(".unset removes an existing variable", async () => {
    const { deps, events, vars } = makeVarDeps();
    vars.set("n", "1");
    await handleDotCommand(".unset n", deps);
    expect(vars.entries()).toEqual({});
    expect(events).toContainEqual({ type: "unsetVariable", name: "n" });
    expect(events).toContainEqual({
      type: "setStatus",
      status: { text: "unset :n", kind: "info" },
    });
  });

  it(".unset on a missing variable reports an error", async () => {
    const { deps, events } = makeVarDeps();
    await handleDotCommand(".unset ghost", deps);
    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: ":ghost is not set", kind: "error" },
      },
    ]);
  });

  it(".vars lists variables from state in insertion order", async () => {
    const { deps, events } = makeVarDeps([
      ["b", "2"],
      ["a", "hello"],
    ]);
    await handleDotCommand(".vars", deps);
    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: ":b = 2\n:a = hello", kind: "info" },
      },
    ]);
  });

  it(".vars reports when there are no variables", async () => {
    const { deps, events } = makeVarDeps([]);
    await handleDotCommand(".vars", deps);
    expect(events).toEqual([
      { type: "setStatus", status: { text: "No variables set", kind: "info" } },
    ]);
  });
});
