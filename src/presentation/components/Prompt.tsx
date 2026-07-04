import { Text } from 'ink';

type Props = { value: string };

export function Prompt({ value }: Props) {
  return (
    <Text>
      {'> '}
      {value}
    </Text>
  );
}