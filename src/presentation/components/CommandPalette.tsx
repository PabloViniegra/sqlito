import { Box, Text } from "ink";
import stringWidth from "string-width";
import type { CommandDescriptor } from "../../application/commands/commandRegistry.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { truncateCell } from "../../shared/utils/formatCell.ts";
import {
  MAX_VISIBLE_OVERLAY_ITEMS,
  OVERLAY_CHROME_LINES,
  overlayItemLimit,
} from "../layout/overlayLayout.ts";
import {
  normalizeLayoutLines,
  normalizeTerminalColumns,
} from "../layout/terminalDimensions.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";

type Props = {
  commands: readonly CommandDescriptor[];
  query: string;
  index: number;
  theme: Theme;
  maxLines?: number;
  columns?: number;
};

const CHROME_LINES = OVERLAY_CHROME_LINES.commandPalette;

type VisibleWindow<T> = { start: number; items: readonly T[] };

function visibleWindow<T>(
  items: readonly T[],
  index: number,
  maxVisible: number,
): VisibleWindow<T> {
  if (items.length <= maxVisible) {
    return { start: 0, items };
  }
  const start = Math.min(
    Math.max(0, index - Math.floor(maxVisible / 2)),
    items.length - maxVisible,
  );
  return { start, items: items.slice(start, start + maxVisible) };
}

export function CommandPalette({
  commands,
  query,
  index,
  theme,
  maxLines = Number.POSITIVE_INFINITY,
  columns,
}: Props) {
  const viewport = useViewportSize();
  const terminalWidth = normalizeTerminalColumns(columns ?? viewport.columns);
  const visibleLines = normalizeLayoutLines(maxLines);
  if (visibleLines <= 0) return null;
  if (visibleLines < CHROME_LINES + 1) {
    return (
      <Text color={theme.tokens.muted} wrap="truncate-end">
        {truncateCell(
          `COMMAND ${query} · ${commands[index]?.name ?? "no matches"} · Enter run · Esc close`,
          terminalWidth,
        )}
      </Text>
    );
  }

  const rule = "─".repeat(terminalWidth);
  const visibleCount = overlayItemLimit(
    commands.length,
    CHROME_LINES,
    visibleLines,
  );
  const { start, items } = visibleWindow(
    commands,
    index,
    Math.max(1, Math.min(MAX_VISIBLE_OVERLAY_ITEMS, visibleCount)),
  );
  const queryText = truncateCell(query, Math.max(1, terminalWidth - 4));

  return (
    <Box
      width={terminalWidth}
      height={Number.isFinite(visibleLines) ? visibleLines : undefined}
      minHeight={0}
      flexDirection="column"
      overflowX="hidden"
      overflowY="hidden"
    >
      <Box
        width={terminalWidth}
        height={1}
        overflowX="hidden"
        overflowY="hidden"
      >
        <Text color={theme.tokens.primary}>▎ </Text>
        <Text color={theme.tokens.primary} bold>
          COMMAND
        </Text>
        <Text color={theme.tokens.muted}> · {commands.length} match</Text>
      </Box>
      <Text color={theme.tokens.muted}>{rule}</Text>
      <Box
        width={terminalWidth}
        height={1}
        overflowX="hidden"
        overflowY="hidden"
      >
        <Text color={theme.tokens.accent} bold>
          {"> "}
        </Text>
        <Text wrap="truncate-end">{queryText}</Text>
        <Text color={theme.tokens.primary}>▌</Text>
      </Box>
      {commands.length === 0 ? (
        <Box
          width={terminalWidth}
          height={1}
          overflowX="hidden"
          overflowY="hidden"
        >
          <Text color={theme.tokens.muted} wrap="truncate-end">
            (no matches)
          </Text>
        </Box>
      ) : (
        items.map((command, i) => {
          const isSelected = start + i === index;
          const name = truncateCell(command.name, terminalWidth);
          const description = truncateCell(
            command.description,
            Math.max(0, terminalWidth - stringWidth(name) - 1),
          );
          return (
            <Box key={command.name} width={terminalWidth} overflowX="hidden">
              <Text
                color={isSelected ? theme.tokens.primary : theme.tokens.accent}
                bold={isSelected}
                inverse={isSelected}
              >
                {name}
              </Text>
              <Box flexGrow={1} />
              {description === "" ? null : (
                <Text color={theme.tokens.muted}> {description}</Text>
              )}
            </Box>
          );
        })
      )}
      <Text color={theme.tokens.muted}>{rule}</Text>
      <Box
        width={terminalWidth}
        height={1}
        overflowX="hidden"
        overflowY="hidden"
      >
        <Text color={theme.tokens.muted} wrap="truncate-end">
          <Text color={theme.tokens.muted} bold>
            ↑↓
          </Text>
          {terminalWidth < 36 ? " move · " : " move   "}
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
    </Box>
  );
}
