import { describe, expect, it } from "vitest";
import stringWidth from "string-width";
import {
  derivePromptLayout,
  promptLineCount,
  promptPrefixForViewport,
} from "./derivePromptLayout.ts";

describe("promptLineCount", () => {
  it("reserves a row when the cursor fills the first prompt line", () => {
    const layout = derivePromptLayout({ text: "x".repeat(78), cursor: 78 }, 78);

    expect(promptLineCount(layout, 80, "> ")).toBe(2);
  });

  it("does not add a row when the cursor still fits", () => {
    const layout = derivePromptLayout({ text: "x".repeat(77), cursor: 77 }, 78);

    expect(promptLineCount(layout, 80, "> ")).toBe(1);
  });

  it("reserves a cursor cell by truncating prefixes in narrow terminals", () => {
    expect(promptPrefixForViewport("(reverse-i-search):", 1)).toBe("");
    expect(
      stringWidth(promptPrefixForViewport("(reverse-i-search):", 4)),
    ).toBeLessThanOrEqual(3);
  });
});
