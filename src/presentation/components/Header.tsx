import { Box, Text } from "ink";
import { memo } from "react";
import type { Theme } from "../../domain/theme/Theme.ts";

const MASCOT = [
  " ▄█▄   ▄█▄ ",
  "█████ █████",
  "█████ █████",
  " ▀█▀   ▀█▀ ",
].join("\n");

// 4-line mascot + round border top + bottom = 6 physical rows.
// Analytics-side consumers (useResultsLayout) read this so the height
// budget cannot desync from this component without an import error.
export const HEADER_LINES = MASCOT.split("\n").length + 2;

type Props = {
  dbPath: string;
  theme: Theme;
};

function HeaderImpl({ dbPath, theme }: Props) {
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

export const Header = memo(HeaderImpl);
