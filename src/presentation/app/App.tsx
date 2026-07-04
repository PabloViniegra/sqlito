import { Box, Static, useApp, useInput } from "ink";
import { useReducer, useState } from "react";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import type { Database } from "../../domain/database/Database.ts";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { appReducer, initialState } from "./appReducer.ts";
import type { PastQuery } from "./appReducer.ts";

type Props = {
  db: Database;
  dbPath: string;
};

export function App({ db, dbPath }: Props) {
  const { exit } = useApp();
  const executeQuery = new ExecuteQuery(db);
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
      const outcome = executeQuery.execute(sql);
      setPastQueries([...pastQueries, { sql, outcome }]);
      dispatch({ type: "submit" });
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
      <Header dbPath={dbPath} />
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
