import { Box, Text } from "ink";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { formatRows } from "../../shared/utils/formatRows.ts";

type Props = { outcome: QueryOutcome; sql: string };

export function ResultsTable({ outcome, sql }: Props) {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text dimColor>{sql}</Text>
      {renderBody(outcome)}
    </Box>
  );
}

function renderBody(outcome: QueryOutcome) {
  switch (outcome.kind) {
    case "rows":
      return formatRows(outcome.columns, outcome.rows).map((line, i) => (
        <Text key={i}>{line}</Text>
      ));
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
