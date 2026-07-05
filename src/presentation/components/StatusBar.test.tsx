import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { StatusBar } from "./StatusBar.tsx";
import { renderInkFrame as capture } from "./renderInkFrame.ts";

chalk.level = 1;

function plain(frame: string): string {
  return stripAnsi(frame).replace(/\r/g, "");
}

describe("StatusBar", () => {
  it("renders the db path, the active theme name, and the status message", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={{ text: "ok", kind: "info" }}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("db.sqlite");
    expect(output).toContain("default");
    expect(output).toContain("ok");
  });

  it("renders the db path and theme name when there is no status message", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={null}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("db.sqlite");
    expect(output).toContain("default");
  });

  it("renders an error status message in the theme's error color", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={{ text: "boom", kind: "error" }}
      />,
    );

    expect(frame).toContain(chalk.red("boom"));
  });

  it("renders an info status message without color", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={{ text: "ok", kind: "info" }}
      />,
    );

    expect(frame).not.toContain(chalk.red("ok"));
    expect(plain(frame)).toContain("ok");
  });

  it("shows the active theme's name instead of a hardcoded one", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={HIGH_CONTRAST_THEME}
        statusMessage={null}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("high-contrast");
    expect(output).not.toContain("default");
  });
});
