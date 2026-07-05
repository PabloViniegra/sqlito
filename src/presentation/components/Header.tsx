import { Box, Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  dbPath: string;
  theme: Theme;
};

export function Header({ dbPath, theme }: Props) {
  return (
    <Box borderStyle="round" borderColor={theme.tokens.border} paddingX={1}>
      <Text color={theme.tokens.accent}>SQLito • {dbPath}</Text>
    </Box>
  );
}
