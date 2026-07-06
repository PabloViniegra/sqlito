import { Box, Text, useStdout } from "ink";
import type { Suggestion } from "../../application/autocomplete/Suggestion.ts";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  suggestions: readonly Suggestion[];
  index: number;
  theme: Theme;
  onCommit?: (replacement: Suggestion) => void;
  onClose?: () => void;
};

const KIND_LABEL: Record<Suggestion["kind"], string> = {
  keyword: "kw",
  table: "table",
  column: "col",
};

export function AutocompletePopup({ suggestions, index, theme }: Props) {
  const { stdout } = useStdout();
  const terminalWidth = stdout.columns ?? 80;
  const rule = "─".repeat(terminalWidth);

  return (
    <Box flexDirection="column">
      <Box>
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
        <Text color={theme.tokens.muted}>(no matches)</Text>
      ) : (
        suggestions.map((s, i) => {
          const isSelected = i === index;
          const labelColor =
            isSelected || s.kind !== "table"
              ? isSelected
                ? theme.tokens.primary
                : undefined
              : theme.tokens.muted;
          return (
            <Box key={`${s.kind}:${s.label}`}>
              <Text
                inverse={isSelected}
                bold={isSelected}
                color={isSelected ? theme.tokens.primary : labelColor}
              >
                {" "}
                {KIND_LABEL[s.kind].padEnd(6)} {s.label}
                {s.detail === undefined ? "" : `  ${s.detail}`}
              </Text>
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
          Enter/Tab
        </Text>
        {" commit   "}
        <Text color={theme.tokens.muted} bold>
          Esc
        </Text>
        {" close"}
      </Text>
    </Box>
  );
}
