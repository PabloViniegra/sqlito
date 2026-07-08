import type { Key } from "ink";
import type { ReadlineIntent } from "./readline.ts";

export function promptKeymapReadlineIntent(
  input: string,
  key: Partial<Key>,
): ReadlineIntent | null {
  if (key.ctrl && input === "a") return { type: "MoveHome" };
  if (key.ctrl && input === "e") return { type: "MoveEnd" };
  if (key.ctrl && input === "k") return { type: "KillToEnd" };
  if (key.ctrl && input === "u") return { type: "KillToStart" };
  if (key.ctrl && input === "w") return { type: "KillWord" };
  if (key.meta && key.leftArrow) return { type: "WordLeft" };
  if (key.meta && key.rightArrow) return { type: "WordRight" };
  return null;
}
