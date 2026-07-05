import type { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { HELP_TEXT } from "../../application/commands/helpText.ts";
import { parseDotCommand } from "../../application/commands/parseCommand.ts";
import type { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import type { RunExplain } from "../../application/queries/RunExplain.ts";
import type { SaveFavorite } from "../../application/favorites/SaveFavorite.ts";
import type { RunFavorite } from "../../application/favorites/RunFavorite.ts";
import type { ForgetFavorite } from "../../application/favorites/ForgetFavorite.ts";
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
};

const FAVORITE_SQL_WIDTH = 60;

export async function handleDotCommand(
  line: string,
  deps: DotCommandDeps,
): Promise<void> {
  const parsed = parseDotCommand(line);
  if (!parsed.ok) {
    setStatus(deps, parsed.error, "error");
    return;
  }
  const command = parsed.command;
  switch (command.kind) {
    case "export":
      await runExport(deps, command.path);
      return;
    case "tables":
      setStatus(deps, deps.schema.tables(), "info");
      return;
    case "indexes":
      setStatus(deps, deps.schema.indexes(), "info");
      return;
    case "schema": {
      const result = deps.schema.schema(command.table);
      if (result.ok) setStatus(deps, result.text, "info");
      else setStatus(deps, result.error, "error");
      return;
    }
    case "help":
      setStatus(deps, HELP_TEXT, "info");
      return;
    case "quit":
      deps.onQuit();
      return;
    case "set":
      runSet(deps, command.name, command.raw);
      return;
    case "unset":
      runUnset(deps, command.name);
      return;
    case "vars":
      setStatus(deps, formatVars(deps.variables), "info");
      return;
    case "explain":
      runExplain(deps);
      return;
    case "save":
      await runSave(deps, command.name);
      return;
    case "favorites":
      setStatus(deps, formatFavorites(deps.favorites), "info");
      return;
    case "run":
      await runFavorite(deps, command.name);
      return;
    case "forget":
      await forgetFavorite(deps, command.name);
      return;
  }
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

function setStatus(
  deps: DotCommandDeps,
  text: string,
  kind: StatusMessage["kind"],
): void {
  deps.dispatch({ type: "setStatus", status: { text, kind } });
}
