import type { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { HELP_TEXT } from "../../application/commands/helpText.ts";
import { parseDotCommand } from "../../application/commands/parseCommand.ts";
import type { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { StatusMessage } from "./appReducer.ts";

export type AppDispatch = (event: {
  type: "setStatus";
  status: StatusMessage | null;
}) => void;

export type DotCommandDeps = {
  dispatch: AppDispatch;
  exportCsv: ExportCsv;
  schema: SchemaPrettyPrint;
  lastRowsOutcome: QueryOutcome | null;
  onQuit: () => void;
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
  }
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
