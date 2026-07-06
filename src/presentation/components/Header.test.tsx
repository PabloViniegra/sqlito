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
  it("renders the wordmark in the theme's primary color with bold", async () => {
    const frame = await capture(
      <Header dbPath="db.sqlite" theme={HIGH_CONTRAST_THEME} />,
    );

    expect(frame).toMatch(/\u001b\[1m\u001b\[93mSQLITO/);
    expect(frame).toMatch(/SQLITO\u001b\[22m/);
  });

  it("renders the wordmark in the default theme's primary color with bold", async () => {
    const frame = await capture(
      <Header dbPath="db.sqlite" theme={DEFAULT_THEME} />,
    );

    expect(frame).toMatch(/\u001b\[1m\u001b\[96mSQLITO/);
    expect(frame).toMatch(/SQLITO\u001b\[22m/);
  });

  it("renders the db path and theme name as plain text", async () => {
    const frame = await capture(
      <Header dbPath="db.sqlite" theme={DEFAULT_THEME} />,
    );

    expect(plain(frame)).toContain("SQLITO");
    expect(plain(frame)).toContain("db.sqlite");
    expect(plain(frame)).toContain("default");
  });

  it("renders the active theme's name", async () => {
    const frame = await capture(
      <Header dbPath="db.sqlite" theme={HIGH_CONTRAST_THEME} />,
    );

    const output = plain(frame);
    expect(output).toContain("high-contrast");
    expect(output).not.toContain("default");
  });

  it("renders the mascot on the same row as the wordmark", async () => {
    const frame = await capture(
      <Header dbPath="db.sqlite" theme={DEFAULT_THEME} />,
    );

    const output = plain(frame);
    const mascotRow = output
      .split("\n")
      .find((l) => l.includes("█████") && l.includes("SQLITO"));
    expect(mascotRow).toBeDefined();
  });
});
