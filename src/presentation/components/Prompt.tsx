import { Box, Text } from "ink";
import { memo } from "react";
import type { Theme } from "../../domain/theme/Theme.ts";
import type { ReadlineState } from "../app/readline.ts";
import {
  DEFAULT_PROMPT_PREFIX,
  derivePromptLayout,
  promptEffectiveWidth,
} from "./derivePromptLayout.ts";

type Props = {
  readlineState: ReadlineState;
  viewportColumns: number;
  prefix?: string;
  theme: Theme;
};

function PromptImpl({ readlineState, viewportColumns, prefix, theme }: Props) {
  const promptPrefix = prefix ?? DEFAULT_PROMPT_PREFIX;
  const effectiveWidth = promptEffectiveWidth(
    viewportColumns,
    promptPrefix.length,
  );
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

export const Prompt = memo(PromptImpl);
