import { Box, Text } from "ink";
import { memo } from "react";
import type { Theme } from "../../domain/theme/Theme.ts";
import { keyedLines } from "../../shared/utils/keyedLines.ts";
import type { ReadlineState } from "../app/readline.ts";
import {
  DEFAULT_PROMPT_PREFIX,
  derivePromptLayout,
  promptPrefixForViewport,
  promptEffectiveWidth,
} from "./derivePromptLayout.ts";

type Props = {
  readlineState: ReadlineState;
  viewportColumns: number;
  prefix?: string;
  theme: Theme;
};

function PromptImpl({ readlineState, viewportColumns, prefix, theme }: Props) {
  const promptPrefix = promptPrefixForViewport(
    prefix ?? DEFAULT_PROMPT_PREFIX,
    viewportColumns,
  );
  const effectiveWidth = promptEffectiveWidth(
    viewportColumns,
    promptPrefix.length,
  );
  const layout = derivePromptLayout(readlineState, effectiveWidth);
  const cursorRowIndex = layout.cursor.row;
  const cursorCol = layout.cursor.col;
  const rows = keyedLines(layout.rows);

  return (
    <Box flexDirection="column">
      {rows.map(({ line: rowText, key }, idx) => {
        const isCursorRow = idx === cursorRowIndex;
        const before = isCursorRow ? rowText.slice(0, cursorCol) : rowText;
        const after = isCursorRow ? rowText.slice(cursorCol) : "";
        const isFirst = idx === 0;
        return (
          <Text key={key}>
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
