import { Box, Text } from "ink";
import type { Suggestion } from "../../application/autocomplete/Suggestion.ts";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  suggestions: readonly Suggestion[];
  index: number;
  theme: Theme;
  onCommit?: (replacement: Suggestion) => void;
  onClose?: () => void;
};

export function AutocompletePopup({ suggestions, index, theme }: Props) {
  if (suggestions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={theme.tokens.dim}>(no matches)</Text>
        <Text color={theme.tokens.dim}>
          {"\u2191\u2193"} move {"   "}
          {"Enter/Tab"} commit {"   "}
          {"Esc"} close
        </Text>
      </Box>
    );
  }
  return (
    <Box flexDirection="column">
      {suggestions.map((s, i) => (
        <Text
          key={`${s.kind}:${s.label}`}
          inverse={i === index}
          color={
            i !== index && s.kind === "table" ? theme.tokens.dim : undefined
          }
        >
          {s.label}
          {s.detail === undefined ? "" : `  ${s.detail}`}
        </Text>
      ))}
      <Text color={theme.tokens.dim}>
        {"\u2191\u2193"} move {"   "}
        {"Enter/Tab"} commit {"   "}
        {"Esc"} close
      </Text>
    </Box>
  );
}
