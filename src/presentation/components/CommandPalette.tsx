import { Box, Text } from "ink";
import type { CommandDescriptor } from "../../application/commands/commandRegistry.ts";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  commands: readonly CommandDescriptor[];
  query: string;
  index: number;
  theme: Theme;
};

// Rendering every match unconditionally lets the live region grow past the
// terminal's row count, which makes Ink fall back to a full clearTerminal +
// repaint on every keystroke instead of a small diff (ink.js's
// shouldClearTerminalForFrame). Cap how many rows we ever emit, and scroll
// the window so the selected command stays reachable via arrow keys.
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
  const { start, items } = visibleWindow(commands, index);
  return (
    <Box flexDirection="column">
      <Text color={theme.tokens.accent}>
        {"> "}
        {query}
      </Text>
      {commands.length === 0 ? (
        <Text color={theme.tokens.dim}>(no matches)</Text>
      ) : (
        items.map((command, i) => (
          <Text key={command.name} inverse={start + i === index}>
            {command.name}
            {`   ${command.description}`}
          </Text>
        ))
      )}
      <Text color={theme.tokens.dim}>
        {"↑↓"} move {"   "}
        {"Enter"} run {"   "}
        {"Esc"} close
      </Text>
    </Box>
  );
}
