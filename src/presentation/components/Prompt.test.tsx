import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { Prompt } from "./Prompt.tsx";
import { renderInkFrame as capture } from "./renderInkFrame.ts";

chalk.level = 1;

function plain(frame: string): string {
  return stripAnsi(frame).replace(/\r/g, "");
}

describe("Prompt", () => {
  it("renders the default prefix in the theme's accent color", async () => {
    const frame = await capture(
      <Prompt value="SELECT 1" theme={HIGH_CONTRAST_THEME} />,
    );

    expect(frame).toContain(chalk.yellow("> "));
    expect(frame).not.toContain(chalk.cyan("> "));
  });

  it("renders prefix and value as plain text under the default theme", async () => {
    const frame = await capture(
      <Prompt value="SELECT 1" theme={DEFAULT_THEME} />,
    );

    expect(plain(frame)).toContain("> SELECT 1");
  });

  it("renders a custom prefix in the theme's accent color", async () => {
    const frame = await capture(
      <Prompt
        value="foo"
        prefix="(reverse-i-search):"
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toContain(chalk.yellow("(reverse-i-search):"));
    expect(plain(frame)).toContain("(reverse-i-search):foo");
  });

  it("does not color the typed value", async () => {
    const frame = await capture(
      <Prompt value="SELECT 1" theme={HIGH_CONTRAST_THEME} />,
    );

    expect(frame).not.toContain(chalk.yellow("SELECT 1"));
  });
});
