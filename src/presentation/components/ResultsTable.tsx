import { Box, Text, useStdout } from "ink";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { formatPlanTree } from "../../shared/utils/formatPlanTree.ts";
import { formatRows } from "../../shared/utils/formatRows.ts";

type Props = { outcome: QueryOutcome; sql: string; theme: Theme };

export function ResultsTable({ outcome, sql, theme }: Props) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.tokens.dim}>{sql}</Text>
      {renderBody(outcome, terminalWidth, theme)}
    </Box>
  );
}

function renderBody(
  outcome: QueryOutcome,
  terminalWidth: number,
  theme: Theme,
) {
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
    case "side-effect":
      return <Text color={theme.tokens.dim}>done</Text>;
    case "plan":
      return formatPlanTree(outcome.nodes, terminalWidth).map((line, i) => (
        <Text key={i}>{line}</Text>
      ));
    case "error":
      return <Text color={theme.tokens.error}>{outcome.message}</Text>;
  }
}
