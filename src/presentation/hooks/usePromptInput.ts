import { useInput, type Key } from "ink";

export function usePromptInput(
  overlayActive: boolean,
  onKey: (input: string, key: Key) => void,
): void {
  useInput(onKey, { isActive: !overlayActive });
}
