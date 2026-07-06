import { Box, Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";

const MASCOT = [
  " ▄█▄   ▄█▄ ",
  "█████ █████",
  "█████ █████",
  " ▀█▀   ▀█▀ ",
].join("\n");

type Props = {
  dbPath: string;
  theme: Theme;
};

export function Header({ dbPath, theme }: Props) {
  return (
    <Box
      borderStyle="round"
      borderColor={theme.tokens.border}
      paddingX={1}
      alignItems="center"
      justifyContent="center"
      gap={1}
    >
      <Text color={theme.tokens.accent}>{MASCOT}</Text>
      <Box>
        <Text color={theme.tokens.primary} bold>
          SQLITO
        </Text>
        <Text color={theme.tokens.muted}> ── </Text>
        <Text color={theme.tokens.dim}>{dbPath}</Text>
        <Text color={theme.tokens.muted}> ── </Text>
        <Text color={theme.tokens.muted}>{theme.name}</Text>
      </Box>
    </Box>
  );
}
