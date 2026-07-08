export type ThemeName = "default" | "high-contrast";

export type ThemeTokens = {
  accent: string;
  primary: string;
  muted: string;
  highlight: string;
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
    primary: "cyanBright",
    muted: "gray",
    highlight: "cyan",
    error: "red",
    success: "green",
    dim: "white",
    border: "white",
  },
};

export const HIGH_CONTRAST_THEME: Theme = {
  name: "high-contrast",
  tokens: {
    accent: "yellow",
    primary: "yellowBright",
    muted: "gray",
    highlight: "yellow",
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
