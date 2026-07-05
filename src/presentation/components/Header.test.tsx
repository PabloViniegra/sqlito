import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { Header } from "./Header.tsx";
import { renderInkFrame as capture } from "./renderInkFrame.ts";

chalk.level = 1;

function plain(frame: string): string {
  return stripAnsi(frame).replace(/\r/g, "");
}

describe("Header", () => {
  it("renders the title in the theme's accent color instead of a hardcoded color", async () => {
    const dbPath = "db.sqlite";
    const frame = await capture(
      <Header dbPath={dbPath} theme={HIGH_CONTRAST_THEME} />,
    );

    expect(frame).toContain(chalk.yellow(`SQLito • ${dbPath}`));
    expect(frame).not.toContain(chalk.cyan(`SQLito • ${dbPath}`));
  });

  it("renders the app name and db path", async () => {
    const frame = await capture(
      <Header dbPath="db.sqlite" theme={DEFAULT_THEME} />,
    );

    expect(plain(frame)).toContain("SQLito • db.sqlite");
  });
});
