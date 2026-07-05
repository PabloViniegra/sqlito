import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { fakeThemeRepository } from "../../domain/theme/ThemeRepository.ts";
import { LoadTheme } from "./LoadTheme.ts";
import { SwitchTheme, UnknownTheme } from "./SwitchTheme.ts";

describe("LoadTheme", () => {
  it("returns the theme from the repository", async () => {
    const repo = fakeThemeRepository(HIGH_CONTRAST_THEME);
    expect(await new LoadTheme(repo).load()).toEqual(HIGH_CONTRAST_THEME);
  });

  it("returns the default theme on a fresh repository", async () => {
    const repo = fakeThemeRepository();
    expect(await new LoadTheme(repo).load()).toEqual(DEFAULT_THEME);
  });
});

describe("SwitchTheme", () => {
  it("switches to a known theme and persists it", async () => {
    const repo = fakeThemeRepository(DEFAULT_THEME);
    const theme = await new SwitchTheme(repo).switch("high-contrast");

    expect(theme).toEqual(HIGH_CONTRAST_THEME);
    expect(await repo.load()).toEqual(HIGH_CONTRAST_THEME);
  });

  it("throws UnknownTheme for an unrecognized name and leaves the repository untouched", async () => {
    const repo = fakeThemeRepository(DEFAULT_THEME);

    await expect(new SwitchTheme(repo).switch("nope")).rejects.toBeInstanceOf(
      UnknownTheme,
    );
    expect(await repo.load()).toEqual(DEFAULT_THEME);
  });
});
