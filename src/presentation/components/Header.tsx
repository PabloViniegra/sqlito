import { Text } from 'ink';

type Props = { dbPath: string };

export function Header({ dbPath }: Props) {
  return <Text color="cyan">SQLito • {dbPath}</Text>;
}