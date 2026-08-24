import { Box, Text } from "ink";
import type { Suggestion } from "../../application/autocomplete/Suggestion.ts";
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
  suggestions: readonly Suggestion[];
  index: number;
  theme: Theme;
  onCommit?: (replacement: Suggestion) => void;
  onClose?: () => void;
  maxLines?: number;
  columns?: number;
};

const KIND_LABEL = {
  keyword: "kw",
  table: "table",
  column: "col",
} satisfies Record<Suggestion["kind"], string>;
const CHROME_LINES = OVERLAY_CHROME_LINES.autocomplete;

export function AutocompletePopup({
  suggestions,
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
          `COMPLETE · ${suggestions[index]?.label ?? "no matches"} · Enter/Tab · Esc`,
          terminalWidth,
        )}
      </Text>
    );
  }

  const rule = "─".repeat(terminalWidth);
  const visibleCount = overlayItemLimit(
    suggestions.length,
    CHROME_LINES,
    visibleLines,
  );
  const maxVisible = Math.max(
    1,
    Math.min(MAX_VISIBLE_OVERLAY_ITEMS, visibleCount),
  );
  const visibleSuggestions =
    suggestions.length <= maxVisible
      ? suggestions
      : suggestions.slice(
          Math.min(
            Math.max(0, index - Math.floor(maxVisible / 2)),
            suggestions.length - maxVisible,
          ),
          Math.min(
            Math.max(0, index - Math.floor(maxVisible / 2)),
            suggestions.length - maxVisible,
          ) + maxVisible,
        );
  const visibleStart =
    suggestions.length <= maxVisible
      ? 0
      : Math.min(
          Math.max(0, index - Math.floor(maxVisible / 2)),
          suggestions.length - maxVisible,
        );

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
          COMPLETE
        </Text>
        <Text color={theme.tokens.muted}>
          {" "}
          · {suggestions.length} match{suggestions.length === 1 ? "" : "es"}
        </Text>
      </Box>
      <Text color={theme.tokens.muted}>{rule}</Text>
      {suggestions.length === 0 ? (
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
        visibleSuggestions.map((s, i) => {
          const isSelected = visibleStart + i === index;
          const labelColor =
            isSelected || s.kind !== "table"
              ? isSelected
                ? theme.tokens.primary
                : undefined
              : theme.tokens.muted;
          const prefix = ` ${KIND_LABEL[s.kind].padEnd(6)} `;
          const line = truncateCell(
            `${prefix}${s.label}${s.detail === undefined ? "" : `  ${s.detail}`}`,
            terminalWidth,
          );
          return (
            <Box key={`${s.kind}:${s.label}`} width={terminalWidth}>
              <Text
                inverse={isSelected}
                bold={isSelected}
                color={isSelected ? theme.tokens.primary : labelColor}
              >
                {line}
              </Text>
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
            Enter/Tab
          </Text>
          {" commit   "}
          <Text color={theme.tokens.muted} bold>
            Esc
          </Text>
          {" close"}
        </Text>
      </Box>
    </Box>
  );
}
