import { Box, Text } from "ink";
import type { StatusMessage } from "../app/appReducer.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";

type Props = {
  dbPath: string;
  theme: Theme;
  statusMessage: StatusMessage | null;
  historyCount: number;
  favoritesCount: number;
};

export function StatusBar({
  dbPath,
  theme,
  statusMessage,
  historyCount,
  favoritesCount,
}: Props) {
  const { columns: terminalWidth } = useViewportSize();
  const rule = "─".repeat(terminalWidth);

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
