import { Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  dbPath: string;
  theme: Theme;
};

export function Header({ dbPath, theme }: Props) {
  return <Text color={theme.tokens.accent}>SQLito • {dbPath}</Text>;
}
