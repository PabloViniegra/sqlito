import { Box, Text } from "ink";
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
  const promptPrefix = prefix ?? "> ";
  const effectiveWidth = Math.max(1, viewportColumns - promptPrefix.length);
  const layout = derivePromptLayout(readlineState, effectiveWidth);
  const cursorRowIndex = layout.cursor.row;
  const cursorCol = layout.cursor.col;

  return (
    <Box flexDirection="column">
      {layout.rows.map((rowText, idx) => {
        const isCursorRow = idx === cursorRowIndex;
        const before = isCursorRow ? rowText.slice(0, cursorCol) : rowText;
        const after = isCursorRow ? rowText.slice(cursorCol) : "";
        const isFirst = idx === 0;
        return (
          <Text key={idx}>
            {isFirst ? (
              <Text color={theme.tokens.accent} bold>
                {promptPrefix}
              </Text>
            ) : null}
            <Text>{before}</Text>
            {isCursorRow ? <Text color={theme.tokens.primary}>▌</Text> : null}
            {isCursorRow ? <Text>{after}</Text> : null}
          </Text>
        );
      })}
    </Box>
  );
}
