import { Box, Text } from "ink";
import { memo } from "react";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import type { StatusMessage } from "../app/appReducer.ts";
import { renderOutcomeChip } from "./outcomeChip.ts";

type Props = {
  dbPath: string;
  theme: Theme;
  statusMessage: StatusMessage | null;
  historyCount: number;
  favoritesCount: number;
  columns: number;
  lastOutcome: QueryOutcome | null;
};

function StatusBarImpl({
  dbPath,
  theme,
  statusMessage,
  historyCount,
  favoritesCount,
  columns,
  lastOutcome,
}: Props) {
  const rule = "─".repeat(columns);

  return (
    <Box flexDirection="column">
      <Text color={theme.tokens.muted}>{rule}</Text>
      <Box paddingX={1}>
        <Box flexShrink={0}>
          <Text color={theme.tokens.success}>● </Text>
          <Text color={theme.tokens.dim}>{dbPath}</Text>
        </Box>
        <Box flexShrink={0}>
          <Text color={theme.tokens.muted}> · </Text>
          <Text color={theme.tokens.muted}>
            {historyCount} history · {favoritesCount} favorites
          </Text>
        </Box>
        {lastOutcome !== null && (
          <Box flexShrink={0}>
            <Text color={theme.tokens.muted}> · </Text>
            <OutcomeChip outcome={lastOutcome} theme={theme} />
          </Box>
        )}
        <Box flexGrow={1} />
        <Hint label="^R" token="search" theme={theme} />
        <Hint label="^P" token="palette" theme={theme} />
        <Hint label="^C" token="quit" theme={theme} />
      </Box>
      {statusMessage !== null ? (
        <Box paddingX={1}>
          <StatusLine message={statusMessage} theme={theme} />
        </Box>
      ) : null}
    </Box>
  );
}

function Hint({
  label,
  token,
  theme,
}: {
  label: string;
  token: string;
  theme: Theme;
}) {
  return (
    <Box flexShrink={0}>
      <Text>
        <Text color={theme.tokens.primary} bold>
          {label}
        </Text>
        <Text color={theme.tokens.muted}> {token} </Text>
      </Text>
    </Box>
  );
}

function StatusLine({
  message,
  theme,
}: {
  message: StatusMessage;
  theme: Theme;
}) {
  if (message.kind === "error") {
    return (
      <Text>
        <Text color={theme.tokens.muted}>! </Text>
        <Text color={theme.tokens.error}>{message.text}</Text>
      </Text>
    );
  }
  return <Text color={theme.tokens.muted}>{message.text}</Text>;
}

function OutcomeChip({
  outcome,
  theme,
}: {
  outcome: QueryOutcome;
  theme: Theme;
}) {
  const { tag, detail } = renderOutcomeChip(outcome);
  return (
    <Text>
      <Text color={theme.tokens.primary} bold>
        {tag}
      </Text>
      {detail !== "" && <Text color={theme.tokens.muted}> {detail}</Text>}
    </Text>
  );
}

export const StatusBar = memo(StatusBarImpl);
