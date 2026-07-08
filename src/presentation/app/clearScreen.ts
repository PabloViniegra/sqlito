export function clearScreenSequence(): string {
  return "\x1b[3J\x1b[H\x1b[2J";
}

export function clearScreen(stdout: NodeJS.WriteStream): void {
  stdout.write(clearScreenSequence());
}
