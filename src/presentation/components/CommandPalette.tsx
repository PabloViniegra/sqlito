import { Box, Text } from "ink";
import type { CommandDescriptor } from "../../application/commands/commandRegistry.ts";
import type { Theme } from "../../domain/theme/Theme.ts";

type Props = {
  commands: readonly CommandDescriptor[];
  query: string;
  index: number;
  theme: Theme;
};

export function CommandPalette({ commands, query, index, theme }: Props) {
  return (
    <Box flexDirection="column">
      <Text color={theme.tokens.accent}>
        {"> "}
        {query}
      </Text>
      {commands.length === 0 ? (
        <Text color={theme.tokens.dim}>(no matches)</Text>
      ) : (
        commands.map((command, i) => (
          <Text key={command.name} inverse={i === index}>
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
