import { Box, Static, useApp, useInput } from "ink";
import { useState } from "react";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import type { Database } from "../../domain/database/Database.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";

type Props = {
  db: Database;
  dbPath: string;
};

type PastQuery = { sql: string; outcome: QueryOutcome };

export function App({ db, dbPath }: Props) {
  const { exit } = useApp();
  const executeQuery = new ExecuteQuery(db);
  const [pastQueries, setPastQueries] = useState<PastQuery[]>([]);
  const [promptValue, setPromptValue] = useState("");

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      db.close();
      exit();
      return;
    }
    if (key.ctrl && input === "u") {
      setPromptValue("");
      return;
    }
    if (key.return) {
      const sql = promptValue.trim();
      if (sql === "") return;
      const outcome = executeQuery.execute(sql);
      setPastQueries([...pastQueries, { sql, outcome }]);
      setPromptValue("");
      return;
    }
    if (key.backspace || key.delete) {
      setPromptValue(promptValue.slice(0, -1));
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      setPromptValue(promptValue + input);
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
      <Prompt value={promptValue} />
    </Box>
  );
}
