import { Box, Text, useStdout } from "ink";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { formatRows } from "../../shared/utils/formatRows.ts";

type Props = { outcome: QueryOutcome; sql: string };

export function ResultsTable({ outcome, sql }: Props) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>{sql}</Text>
      {renderBody(outcome, terminalWidth)}
    </Box>
  );
}

function renderBody(outcome: QueryOutcome, terminalWidth: number) {
  switch (outcome.kind) {
    case "rows":
      return formatRows(outcome.columns, outcome.rows, terminalWidth).map(
        (line, i) => <Text key={i}>{line}</Text>,
      );
    case "affected": {
      const showRowid = Number(outcome.lastInsertRowid) > 0;
      return (
        <Text>
          {outcome.changes} rows affected
          {showRowid ? ` (last insert rowid: ${outcome.lastInsertRowid})` : ""}
        </Text>
      );
    }
    case "error":
      return <Text color="red">{outcome.message}</Text>;
  }
}
