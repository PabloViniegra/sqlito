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
    runExplain: {
      explainLast: vi.fn(),
    } as unknown as DotCommandDeps["runExplain"],
    lastSql: "",
    showResult: vi.fn(),
    saveFavorite: {
      save: vi.fn(),
    } as unknown as DotCommandDeps["saveFavorite"],
    runFavorite: { get: vi.fn() } as unknown as DotCommandDeps["runFavorite"],
    forgetFavorite: {
      forget: vi.fn(),
    } as unknown as DotCommandDeps["forgetFavorite"],
    favorites: [],
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
      runExplain: {
        explainLast: vi.fn(),
      } as unknown as DotCommandDeps["runExplain"],
      lastSql: "",
      showResult: vi.fn(),
      saveFavorite: {
        save: vi.fn(),
      } as unknown as DotCommandDeps["saveFavorite"],
      runFavorite: { get: vi.fn() } as unknown as DotCommandDeps["runFavorite"],
      forgetFavorite: {
        forget: vi.fn(),
      } as unknown as DotCommandDeps["forgetFavorite"],
      favorites: [],
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

describe("handleDotCommand — explain", () => {
  function makeExplainDeps(
    result: QueryOutcome,
    lastSql = "SELECT 1",
  ): {
    deps: DotCommandDeps;
    statuses: (StatusMessage | null)[];
    shown: { sql: string; outcome: QueryOutcome }[];
    explainLast: ReturnType<typeof vi.fn>;
  } {
    const statuses: (StatusMessage | null)[] = [];
    const shown: { sql: string; outcome: QueryOutcome }[] = [];
    const explainLast = vi.fn().mockReturnValue(result);
    const deps: DotCommandDeps = {
      dispatch: (event) => {
        if (event.type === "setStatus") statuses.push(event.status);
      },
      exportCsv: { run: vi.fn() } as unknown as DotCommandDeps["exportCsv"],
      schema: {} as unknown as DotCommandDeps["schema"],
      lastRowsOutcome: null,
      onQuit: vi.fn(),
      sessionVars: new SessionVariables(),
      variables: [],
      runExplain: { explainLast } as unknown as DotCommandDeps["runExplain"],
      lastSql,
      showResult: (sql, outcome) => shown.push({ sql, outcome }),
      saveFavorite: {
        save: vi.fn(),
      } as unknown as DotCommandDeps["saveFavorite"],
      runFavorite: { get: vi.fn() } as unknown as DotCommandDeps["runFavorite"],
      forgetFavorite: {
        forget: vi.fn(),
      } as unknown as DotCommandDeps["forgetFavorite"],
      favorites: [],
    };
    return { deps, statuses, shown, explainLast };
  }

  it("renders the plan and reports the node count", async () => {
    const plan: QueryOutcome = {
      kind: "plan",
      nodes: [
        {
          id: 1,
          parent: 0,
          detail: "SCAN t",
          depth: 0,
          children: [
            { id: 2, parent: 1, detail: "USE INDEX", depth: 1, children: [] },
          ],
        },
        { id: 3, parent: 0, detail: "SCAN u", depth: 0, children: [] },
      ],
    };
    const { deps, statuses, shown, explainLast } = makeExplainDeps(
      plan,
      "SELECT * FROM t",
    );
    await handleDotCommand(".explain", deps);
    expect(explainLast).toHaveBeenCalledWith("SELECT * FROM t");
    expect(shown).toEqual([
      { sql: "EXPLAIN QUERY PLAN SELECT * FROM t", outcome: plan },
    ]);
    expect(statuses).toEqual([{ text: "explained: 3 nodes", kind: "info" }]);
  });

  it("reports an error and renders nothing when explain fails", async () => {
    const err: QueryOutcome = {
      kind: "error",
      message: "no previous query to explain",
    };
    const { deps, statuses, shown } = makeExplainDeps(err, "");
    await handleDotCommand(".explain", deps);
    expect(shown).toEqual([]);
    expect(statuses).toEqual([
      { text: "no previous query to explain", kind: "error" },
    ]);
  });
});

describe("handleDotCommand — favorites", () => {
  function makeFavDeps(
    over: {
      lastSql?: string;
      favorites?: readonly [string, string][];
      getResult?: string | undefined;
      forgetResult?: boolean;
    } = {},
  ): {
    deps: DotCommandDeps;
    events: unknown[];
    save: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    forget: ReturnType<typeof vi.fn>;
  } {
    const events: unknown[] = [];
    const save = vi.fn().mockResolvedValue(undefined);
    const get = vi.fn().mockResolvedValue(over.getResult);
    const forget = vi.fn().mockResolvedValue(over.forgetResult ?? false);
    const deps: DotCommandDeps = {
      dispatch: (event) => events.push(event),
      exportCsv: { run: vi.fn() } as unknown as DotCommandDeps["exportCsv"],
      schema: {} as unknown as DotCommandDeps["schema"],
      lastRowsOutcome: null,
      onQuit: vi.fn(),
      sessionVars: new SessionVariables(),
      variables: [],
      runExplain: {
        explainLast: vi.fn(),
      } as unknown as DotCommandDeps["runExplain"],
      lastSql: over.lastSql ?? "",
      showResult: vi.fn(),
      saveFavorite: { save } as unknown as DotCommandDeps["saveFavorite"],
      runFavorite: { get } as unknown as DotCommandDeps["runFavorite"],
      forgetFavorite: { forget } as unknown as DotCommandDeps["forgetFavorite"],
      favorites: over.favorites ?? [],
    };
    return { deps, events, save, get, forget };
  }

  it(".save persists the last query and commits it", async () => {
    const { deps, events, save } = makeFavDeps({ lastSql: "SELECT 1" });
    await handleDotCommand(".save top", deps);
    expect(save).toHaveBeenCalledWith("top", "SELECT 1");
    expect(events).toContainEqual({
      type: "commitFavorite",
      name: "top",
      sql: "SELECT 1",
    });
    expect(events).toContainEqual({
      type: "setStatus",
      status: { text: "saved top", kind: "info" },
    });
  });

  it(".save errors when there is no last query", async () => {
    const { deps, events, save } = makeFavDeps({ lastSql: "" });
    await handleDotCommand(".save top", deps);
    expect(save).not.toHaveBeenCalled();
    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: "nothing to save (run a query first)", kind: "error" },
      },
    ]);
  });

  it(".favorites lists entries sorted and truncated", async () => {
    const longSql = "SELECT " + "x".repeat(80) + " FROM t";
    const { deps, events } = makeFavDeps({
      favorites: [
        ["zeta", "SELECT 2"],
        ["alpha", longSql],
      ],
    });
    await handleDotCommand(".favorites", deps);
    const status = events[0] as { status: StatusMessage };
    const lines = status.status.text.split("\n");
    expect(lines[0].startsWith("alpha:")).toBe(true);
    expect(lines[1].startsWith("zeta:")).toBe(true);
    expect(lines[0]).toContain("…");
    expect(lines[0].length).toBeLessThan(80);
  });

  it(".favorites reports when empty", async () => {
    const { deps, events } = makeFavDeps({ favorites: [] });
    await handleDotCommand(".favorites", deps);
    expect(events).toEqual([
      { type: "setStatus", status: { text: "No favorites", kind: "info" } },
    ]);
  });

  it(".run loads the SQL into the prompt without executing", async () => {
    const { deps, events, get } = makeFavDeps({ getResult: "SELECT 42" });
    await handleDotCommand(".run top", deps);
    expect(get).toHaveBeenCalledWith("top");
    expect(events).toContainEqual({ type: "setPrompt", value: "SELECT 42" });
    expect(events).toContainEqual({
      type: "setStatus",
      status: { text: "loaded top", kind: "info" },
    });
  });

  it(".run errors for an unknown favorite", async () => {
    const { deps, events } = makeFavDeps({ getResult: undefined });
    await handleDotCommand(".run ghost", deps);
    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: "no favorite named ghost", kind: "error" },
      },
    ]);
  });

  it(".forget removes an existing favorite", async () => {
    const { deps, events, forget } = makeFavDeps({ forgetResult: true });
    await handleDotCommand(".forget top", deps);
    expect(forget).toHaveBeenCalledWith("top");
    expect(events).toContainEqual({ type: "removeFavorite", name: "top" });
    expect(events).toContainEqual({
      type: "setStatus",
      status: { text: "forgot top", kind: "info" },
    });
  });

  it(".forget errors for an unknown favorite", async () => {
    const { deps, events } = makeFavDeps({ forgetResult: false });
    await handleDotCommand(".forget ghost", deps);
    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: "no favorite named ghost", kind: "error" },
      },
    ]);
  });
});
