import type { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { parseExportCommand } from "../../application/commands/parseCommand.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { StatusMessage } from "./appReducer.ts";

export type AppDispatch = (event: {
  type: "setStatus";
  status: StatusMessage | null;
}) => void;

export async function handleDotCommand(
  line: string,
  dispatch: AppDispatch,
  exportCsv: ExportCsv,
  lastRowsOutcome: QueryOutcome | null,
): Promise<void> {
  const parsed = parseExportCommand(line);
  if (!parsed.ok) {
    dispatch({
      type: "setStatus",
      status: { text: parsed.error, kind: "error" },
    });
    return;
  }
  if (lastRowsOutcome === null) {
    dispatch({
      type: "setStatus",
      status: { text: "No tabular result to export", kind: "error" },
    });
    return;
  }
  try {
    const result = await exportCsv.run(lastRowsOutcome, parsed.path);
    dispatch({
      type: "setStatus",
      status: {
        text: `Exported ${result.rowsWritten} rows to ${result.path}`,
        kind: "info",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    dispatch({ type: "setStatus", status: { text: message, kind: "error" } });
  }
}
