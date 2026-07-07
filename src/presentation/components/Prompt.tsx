import { Text } from "ink";
import type { Theme } from "../../domain/theme/Theme.ts";
import type { ReadlineState } from "../app/readline.ts";
import { derivePromptLayout } from "./derivePromptLayout.ts";

type Props = {
  readlineState: ReadlineState;
  viewportColumns: number;
  prefix?: string;
  theme: Theme;
};

export function Prompt({
  readlineState,
  viewportColumns,
  prefix,
  theme,
}: Props) {
  const layout = derivePromptLayout(readlineState, viewportColumns);
  const cursorRow = layout.rows[layout.cursor.row] ?? {
    text: readlineState.text,
  };
  const before = cursorRow.text.slice(0, layout.cursor.col);
  const after = cursorRow.text.slice(layout.cursor.col);

  return (
    <Text>
      <Text color={theme.tokens.accent} bold>
        {prefix ?? "> "}
      </Text>
      <Text>{before}</Text>
      <Text color={theme.tokens.primary}>▌</Text>
      <Text>{after}</Text>
    </Text>
  );
}
