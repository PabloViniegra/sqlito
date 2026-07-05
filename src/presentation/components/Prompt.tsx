import { Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = { value: string; prefix?: string; theme: Theme };

export function Prompt({ value, prefix, theme }: Props) {
  return (
    <Text>
      <Text color={theme.tokens.accent}>{prefix ?? "> "}</Text>
      {value}
      <Text inverse> </Text>
    </Text>
  );
}
