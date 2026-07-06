import { Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = { value: string; prefix?: string; theme: Theme };

export function Prompt({ value, prefix, theme }: Props) {
  return (
    <Text>
      <Text color={theme.tokens.accent} bold>
        {prefix ?? "> "}
      </Text>
      {value === "" ? (
        <Text color={theme.tokens.primary}>▌</Text>
      ) : (
        <>
          <Text>{value}</Text>
          <Text color={theme.tokens.primary}>▌</Text>
        </>
      )}
    </Text>
  );
}
