import { Box, Text } from "ink";
import type { Suggestion } from "../../application/autocomplete/Suggestion.ts";

type Props = {
  suggestions: readonly Suggestion[];
  index: number;
  onCommit?: (replacement: Suggestion) => void;
  onClose?: () => void;
};

export function AutocompletePopup({ suggestions, index }: Props) {
  if (suggestions.length === 0) {
    return (
      <Box flexDirection="column">
        <Text dimColor>(no matches)</Text>
        <Text dimColor>
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
          dimColor={i !== index && s.kind === "table"}
        >
          {s.label}
          {s.detail === undefined ? "" : `  ${s.detail}`}
        </Text>
      ))}
      <Text dimColor>
        {"\u2191\u2193"} move {"   "}
        {"Enter/Tab"} commit {"   "}
        {"Esc"} close
      </Text>
    </Box>
  );
}
