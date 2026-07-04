import { Box, Text } from "ink";
import chalk from "chalk";
import type { StatusMessage } from "../app/appReducer.ts";

type Props = {
  dbPath: string;
  statusMessage: StatusMessage | null;
};

export function Header({ dbPath, statusMessage }: Props) {
  return (
    <Box flexDirection="column">
      <Text color="cyan">SQLito • {dbPath}</Text>
      {statusMessage !== null ? <StatusLine message={statusMessage} /> : null}
    </Box>
  );
}

function StatusLine({ message }: { message: StatusMessage }) {
  const text =
    message.kind === "error" ? chalk.red(message.text) : message.text;
  return <Text>{text}</Text>;
}
