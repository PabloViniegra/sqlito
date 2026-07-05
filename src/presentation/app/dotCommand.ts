import type { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { HELP_TEXT } from "../../application/commands/helpText.ts";
import { parseDotCommand } from "../../application/commands/parseCommand.ts";
import type { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import {
  InvalidVariableName,
  type SessionVariables,
} from "../../application/variables/SessionVariables.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
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
};

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
  }
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
