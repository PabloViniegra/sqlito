import { DEFAULT_THEME, type Theme } from "./Theme.ts";

export type ThemeRepository = {
  load: () => Promise<Theme>;
  save: (theme: Theme) => Promise<void>;
};

export function fakeThemeRepository(
  initial: Theme = DEFAULT_THEME,
): ThemeRepository {
  let stored: Theme = initial;
  return {
    async load(): Promise<Theme> {
      return stored;
    },
    async save(theme: Theme): Promise<void> {
      stored = theme;
    },
  };
}
