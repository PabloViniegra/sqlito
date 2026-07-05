export type ThemeName = "default" | "high-contrast";

export type ThemeTokens = {
  accent: string;
  error: string;
  success: string;
  dim: string;
  border: string;
};

export type Theme = {
  name: ThemeName;
  tokens: ThemeTokens;
};

export const DEFAULT_THEME: Theme = {
  name: "default",
  tokens: {
    accent: "cyan",
    error: "red",
    success: "green",
    dim: "gray",
    border: "gray",
  },
};

export const HIGH_CONTRAST_THEME: Theme = {
  name: "high-contrast",
  tokens: {
    accent: "yellow",
    error: "redBright",
    success: "greenBright",
    dim: "white",
    border: "white",
  },
};

const THEMES: readonly Theme[] = [DEFAULT_THEME, HIGH_CONTRAST_THEME];

export function findTheme(name: string): Theme | undefined {
  return THEMES.find((theme) => theme.name === name);
}
