export function keyedLines(lines: readonly string[]): {
  key: string;
  line: string;
}[] {
  const occurrences = new Map<string, number>();
  return lines.map((line) => {
    const occurrence = occurrences.get(line) ?? 0;
    occurrences.set(line, occurrence + 1);
    return { key: `${line}\u0000${occurrence}`, line };
  });
}
