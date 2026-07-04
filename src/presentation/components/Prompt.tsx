import { Text } from "ink";

type Props = { value: string; prefix?: string };

export function Prompt({ value, prefix }: Props) {
  if (prefix === undefined) {
    return (
      <Text>
        {"> "}
        {value}
      </Text>
    );
  }
  return (
    <Text>
      {prefix}
      {value}
    </Text>
  );
}
