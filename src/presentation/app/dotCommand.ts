import type { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { COMMAND_DESCRIPTORS } from "../../application/commands/commandRegistry.ts";
import { HELP_TEXT } from "../../application/commands/helpText.ts";
import {
  parseDotCommand,
  type DotCommand,
} from "../../application/commands/parseCommand.ts";
import type { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import type { RunExplain } from "../../application/queries/RunExplain.ts";
import type { SaveFavorite } from "../../application/favorites/SaveFavorite.ts";
import type { RunFavorite } from "../../application/favorites/RunFavorite.ts";
import type { ForgetFavorite } from "../../application/favorites/ForgetFavorite.ts";
import type { SwitchTheme } from "../../application/theme/SwitchTheme.ts";
import {
  InvalidVariableName,
  type SessionVariables,
} from "../../application/variables/SessionVariables.ts";
import type { PlanNode } from "../../domain/sql/PlanNode.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import cliTruncate from "cli-truncate";
import type { AppEvent, StatusMessage } from "./appReducer.ts";

export type AppDispatch = (event: AppEvent) => void;

export type DotCommandDeps = {
  dispatch: AppDispatch;
  exportCsv: ExportCsv;
  schema: SchemaPrettyPrint;
  lastRowsOutcome: QueryOutcome | null;
  onQuit: () => void;
  sessionVars: SessionVariables;
  variables: readonly [string, string][];
  runExplain: RunExplain;
  lastSql: string;
  showResult: (sql: string, outcome: QueryOutcome) => void;
  saveFavorite: SaveFavorite;
  runFavorite: RunFavorite;
  forgetFavorite: ForgetFavorite;
  favorites: readonly [string, string][];
  switchTheme: SwitchTheme;
};

const FAVORITE_SQL_WIDTH = 60;

type CommandHandler<K extends DotCommand["kind"]> = (
  command: Extract<DotCommand, { kind: K }>,
  deps: DotCommandDeps,
) => void | Promise<void>;

type CommandEntry<K extends DotCommand["kind"]> =
  (typeof COMMAND_DESCRIPTORS)[K] & { run: CommandHandler<K> };

type CommandRegistry = { [K in DotCommand["kind"]]: CommandEntry<K> };

export const COMMAND_REGISTRY: CommandRegistry = {
  tables: {
    ...COMMAND_DESCRIPTORS.tables,
    run: (_command, deps) => setStatus(deps, deps.schema.tables(), "info"),
  },
  schema: {
    ...COMMAND_DESCRIPTORS.schema,
    run: (command, deps) => {
      const result = deps.schema.schema(command.table);
      if (result.ok) setStatus(deps, result.text, "info");
      else setStatus(deps, result.error, "error");
    },
  },
  indexes: {
    ...COMMAND_DESCRIPTORS.indexes,
    run: (_command, deps) => setStatus(deps, deps.schema.indexes(), "info"),
  },
  help: {
    ...COMMAND_DESCRIPTORS.help,
    run: (_command, deps) => setStatus(deps, HELP_TEXT, "info"),
  },
  quit: {
    ...COMMAND_DESCRIPTORS.quit,
    run: (_command, deps) => deps.onQuit(),
  },
  set: {
    ...COMMAND_DESCRIPTORS.set,
    run: (command, deps) => runSet(deps, command.name, command.raw),
  },
  unset: {
    ...COMMAND_DESCRIPTORS.unset,
    run: (command, deps) => runUnset(deps, command.name),
  },
  vars: {
    ...COMMAND_DESCRIPTORS.vars,
    run: (_command, deps) =>
      setStatus(deps, formatVars(deps.variables), "info"),
  },
  explain: {
    ...COMMAND_DESCRIPTORS.explain,
    run: (_command, deps) => runExplain(deps),
  },
  save: {
    ...COMMAND_DESCRIPTORS.save,
    run: (command, deps) => runSave(deps, command.name),
  },
  favorites: {
    ...COMMAND_DESCRIPTORS.favorites,
    run: (_command, deps) =>
      setStatus(deps, formatFavorites(deps.favorites), "info"),
  },
  run: {
    ...COMMAND_DESCRIPTORS.run,
    run: (command, deps) => runFavorite(deps, command.name),
  },
  forget: {
    ...COMMAND_DESCRIPTORS.forget,
    run: (command, deps) => forgetFavorite(deps, command.name),
  },
  export: {
    ...COMMAND_DESCRIPTORS.export,
    run: (command, deps) => runExport(deps, command.path),
  },
  theme: {
    ...COMMAND_DESCRIPTORS.theme,
    run: (command, deps) => runTheme(deps, command.name),
  },
};

function dispatchCommand<K extends DotCommand["kind"]>(
  command: Extract<DotCommand, { kind: K }>,
  deps: DotCommandDeps,
): void | Promise<void> {
  return COMMAND_REGISTRY[command.kind].run(command, deps);
}

export async function handleDotCommand(
  line: string,
  deps: DotCommandDeps,
): Promise<void> {
  const parsed = parseDotCommand(line);
  if (!parsed.ok) {
    setStatus(deps, parsed.error, "error");
    return;
  }
  await dispatchCommand(parsed.command, deps);
}

async function runSave(deps: DotCommandDeps, name: string): Promise<void> {
  const sql = deps.lastSql.trim();
  if (sql === "") {
    setStatus(deps, "nothing to save (run a query first)", "error");
    return;
  }
  try {
    await deps.saveFavorite.save(name, sql);
  } catch (err) {
    setStatus(deps, err instanceof Error ? err.message : String(err), "error");
    return;
  }
  deps.dispatch({ type: "commitFavorite", name, sql });
  setStatus(deps, `saved ${name}`, "info");
}

async function runFavorite(deps: DotCommandDeps, name: string): Promise<void> {
  let sql: string | undefined;
  try {
    sql = await deps.runFavorite.get(name);
  } catch (err) {
    setStatus(deps, err instanceof Error ? err.message : String(err), "error");
    return;
  }
  if (sql === undefined) {
    setStatus(deps, `no favorite named ${name}`, "error");
    return;
  }
  deps.dispatch({ type: "setPrompt", value: sql });
  setStatus(deps, `loaded ${name}`, "info");
}

async function forgetFavorite(
  deps: DotCommandDeps,
  name: string,
): Promise<void> {
  let existed: boolean;
  try {
    existed = await deps.forgetFavorite.forget(name);
  } catch (err) {
    setStatus(deps, err instanceof Error ? err.message : String(err), "error");
    return;
  }
  if (!existed) {
    setStatus(deps, `no favorite named ${name}`, "error");
    return;
  }
  deps.dispatch({ type: "removeFavorite", name });
  setStatus(deps, `forgot ${name}`, "info");
}

function formatFavorites(favorites: readonly [string, string][]): string {
  if (favorites.length === 0) return "No favorites";
  return [...favorites]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, sql]) => `${name}: ${cliTruncate(sql, FAVORITE_SQL_WIDTH)}`)
    .join("\n");
}

function runExplain(deps: DotCommandDeps): void {
  const outcome = deps.runExplain.explainLast(deps.lastSql);
  if (outcome.kind === "error") {
    setStatus(deps, outcome.message, "error");
    return;
  }
  deps.showResult(`EXPLAIN QUERY PLAN ${deps.lastSql}`, outcome);
  const count = outcome.kind === "plan" ? countPlanNodes(outcome.nodes) : 0;
  setStatus(deps, `explained: ${count} nodes`, "info");
}

function countPlanNodes(nodes: readonly PlanNode[]): number {
  return nodes.reduce(
    (total, node) => total + 1 + countPlanNodes(node.children),
    0,
  );
}

function runSet(deps: DotCommandDeps, name: string, raw: string): void {
  try {
    deps.sessionVars.set(name, raw);
  } catch (err) {
    if (err instanceof InvalidVariableName) {
      setStatus(deps, err.message, "error");
      return;
    }
    throw err;
  }
  deps.dispatch({ type: "setVariable", name, raw });
  setStatus(deps, `set :${name} = ${raw}`, "info");
}

function runUnset(deps: DotCommandDeps, name: string): void {
  if (!deps.sessionVars.unset(name)) {
    setStatus(deps, `:${name} is not set`, "error");
    return;
  }
  deps.dispatch({ type: "unsetVariable", name });
  setStatus(deps, `unset :${name}`, "info");
}

function formatVars(variables: readonly [string, string][]): string {
  if (variables.length === 0) return "No variables set";
  return variables.map(([name, raw]) => `:${name} = ${raw}`).join("\n");
}

async function runExport(deps: DotCommandDeps, path: string): Promise<void> {
  if (deps.lastRowsOutcome === null) {
    setStatus(deps, "No tabular result to export", "error");
    return;
  }
  try {
    const result = await deps.exportCsv.run(deps.lastRowsOutcome, path);
    setStatus(
      deps,
      `Exported ${result.rowsWritten} rows to ${result.path}`,
      "info",
    );
  } catch (err) {
    setStatus(deps, err instanceof Error ? err.message : String(err), "error");
  }
}

async function runTheme(deps: DotCommandDeps, name: string): Promise<void> {
  try {
    const theme = await deps.switchTheme.switch(name);
    deps.dispatch({ type: "setTheme", theme });
    setStatus(deps, `theme set to ${theme.name}`, "info");
  } catch (err) {
    setStatus(deps, err instanceof Error ? err.message : String(err), "error");
  }
}

function setStatus(
  deps: DotCommandDeps,
  text: string,
  kind: StatusMessage["kind"],
): void {
  deps.dispatch({ type: "setStatus", status: { text, kind } });
}
