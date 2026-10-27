import type { Key } from "ink";

/** The Ink key flags the overlay handlers read, so tests can build keys without Ink. */
export type OverlayKey = Pick<
  Key,
  | "return"
  | "escape"
  | "tab"
  | "upArrow"
  | "downArrow"
  | "backspace"
  | "delete"
  | "ctrl"
  | "meta"
>;
