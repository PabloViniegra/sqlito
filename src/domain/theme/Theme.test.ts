import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, HIGH_CONTRAST_THEME, findTheme } from "./Theme.ts";

describe("findTheme", () => {
  it("returns the default theme for 'default'", () => {
    expect(findTheme("default")).toEqual(DEFAULT_THEME);
  });

  it("returns the high-contrast theme for 'high-contrast'", () => {
    expect(findTheme("high-contrast")).toEqual(HIGH_CONTRAST_THEME);
  });

  it("returns undefined for an unknown theme name", () => {
    expect(findTheme("nope")).toBeUndefined();
  });
});
