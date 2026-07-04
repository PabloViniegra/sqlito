import { Box, Text } from 'ink';
import type { QueryOutcome } from '../../domain/sql/QueryOutcome.ts';
import { formatRows } from '../../shared/utils/formatRows.ts';

type Props = { outcome: QueryOutcome; sql: string };

export function ResultsTable({ outcome, sql }: Props) {
  if (outcome.kind === 'rows') {
    const lines = formatRows(outcome.columns, outcome.rows);
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text dimColor>{sql}</Text>
        {lines.map((line, i) => (
          <Text key={i}>{line}</Text>
        ))}
      </Box>
    );
  }
  return null;
}