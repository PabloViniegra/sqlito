import { Box, Text } from "ink";
import type { StatusMessage } from "../app/appReducer.ts";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  dbPath: string;
  theme: Theme;
  statusMessage: StatusMessage | null;
};

export function StatusBar({ dbPath, theme, statusMessage }: Props) {
  return (
    <Box flexDirection="column">
      <Text color={theme.tokens.dim}>
        {dbPath} • {theme.name}
      </Text>
      {statusMessage !== null ? (
        <StatusLine message={statusMessage} theme={theme} />
      ) : null}
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
    return <Text color={theme.tokens.error}>{message.text}</Text>;
  }
  return <Text>{message.text}</Text>;
}
