import { Box, Static, useApp, useInput } from "ink";
import { useReducer, useState } from "react";
import { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { parseExportCommand } from "../../application/commands/parseCommand.ts";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import type { Database } from "../../domain/database/Database.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import type { StatusMessage } from "./appReducer.ts";
import { appReducer, initialState } from "./appReducer.ts";
import type { PastQuery } from "./appReducer.ts";

type Props = {
  db: Database;
  dbPath: string;
};

export function App({ db, dbPath }: Props) {
  const { exit } = useApp();
  const executeQuery = new ExecuteQuery(db);
  const exportCsv = new ExportCsv();
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [pastQueries, setPastQueries] = useState<PastQuery[]>([]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      db.close();
      dispatch({ type: "exit" });
      exit();
      return;
    }
    if (key.ctrl && input === "u") {
      dispatch({ type: "clearPrompt" });
      return;
    }
    if (key.return) {
      const sql = state.prompt.trim();
      if (sql === "") return;
      if (sql.startsWith(".")) {
        void handleDotCommand(sql, dispatch, exportCsv, state.lastRowsOutcome);
        dispatch({ type: "command", line: sql });
        return;
      }
      const outcome = executeQuery.execute(sql);
      setPastQueries([...pastQueries, { sql, outcome }]);
      dispatch({ type: "submit", outcome });
      return;
    }
    if (key.backspace || key.delete) {
      dispatch({ type: "backspace" });
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      dispatch({ type: "setPrompt", value: state.prompt + input });
    }
  });

  return (
    <Box flexDirection="column">
      <Header dbPath={dbPath} statusMessage={state.statusMessage} />
      {pastQueries.length > 0 && (
        <Static items={pastQueries}>
          {(item, index) => (
            <ResultsTable key={index} outcome={item.outcome} sql={item.sql} />
          )}
        </Static>
      )}
      <Prompt value={state.prompt} />
    </Box>
  );
}

async function handleDotCommand(
  line: string,
  dispatch: (event: {
    type: "setStatus";
    status: StatusMessage | null;
  }) => void,
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
    dispatch({
      type: "setStatus",
      status: { text: message, kind: "error" },
    });
  }
}
