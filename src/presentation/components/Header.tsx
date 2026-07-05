import { Box, Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";

// ponytail: 11x8-pixel sprite, half-block encoded (2 px per row) — two rounded cheeks, split by a center seam
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
      <Text color={theme.tokens.accent}>SQLito • {dbPath}</Text>
    </Box>
  );
}
