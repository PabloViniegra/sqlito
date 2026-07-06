import { Box, Text } from "ink";
import type { CommandDescriptor } from "../../application/commands/commandRegistry.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";

type Props = {
  commands: readonly CommandDescriptor[];
  query: string;
  index: number;
  theme: Theme;
};

const MAX_VISIBLE = 10;

function visibleWindow<T>(
  items: readonly T[],
  index: number,
): { start: number; items: readonly T[] } {
  if (items.length <= MAX_VISIBLE) {
    return { start: 0, items };
  }
  const start = Math.min(
    Math.max(0, index - Math.floor(MAX_VISIBLE / 2)),
    items.length - MAX_VISIBLE,
  );
  return { start, items: items.slice(start, start + MAX_VISIBLE) };
}

export function CommandPalette({ commands, query, index, theme }: Props) {
  const { columns: terminalWidth } = useViewportSize();
  const rule = "─".repeat(terminalWidth);
  const { start, items } = visibleWindow(commands, index);

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={theme.tokens.primary}>▎ </Text>
        <Text color={theme.tokens.primary} bold>
          COMMAND
        </Text>
        <Text color={theme.tokens.muted}> · {commands.length} match</Text>
      </Box>
      <Text color={theme.tokens.muted}>{rule}</Text>
      <Box>
        <Text color={theme.tokens.accent} bold>
          {"> "}
        </Text>
        <Text>{query}</Text>
        <Text color={theme.tokens.primary}>▌</Text>
      </Box>
      {commands.length === 0 ? (
        <Text color={theme.tokens.muted}>(no matches)</Text>
      ) : (
        items.map((command, i) => {
          const isSelected = start + i === index;
          return (
            <Box key={command.name} justifyContent="space-between">
              <Box>
                <Text
                  color={
                    isSelected ? theme.tokens.primary : theme.tokens.accent
                  }
                  bold={isSelected}
                  inverse={isSelected}
                >
                  {command.name}
                </Text>
              </Box>
              <Text color={theme.tokens.muted}>{command.description}</Text>
            </Box>
          );
        })
      )}
      <Text color={theme.tokens.muted}>{rule}</Text>
      <Text color={theme.tokens.muted}>
        <Text color={theme.tokens.muted} bold>
          ↑↓
        </Text>
        {" move   "}
        <Text color={theme.tokens.muted} bold>
          Enter
        </Text>
        {" run   "}
        <Text color={theme.tokens.muted} bold>
          Esc
        </Text>
        {" close"}
      </Text>
    </Box>
  );
}
