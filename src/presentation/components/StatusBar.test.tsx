import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import { DEFAULT_THEME } from "../../domain/theme/Theme.ts";
import { StatusBar } from "./StatusBar.tsx";
import { renderInkFrame as capture } from "./renderInkFrame.ts";

chalk.level = 1;

function plain(frame: string): string {
  return stripAnsi(frame).replace(/\r/g, "");
}

describe("StatusBar", () => {
  it("renders the db path on the status line", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={null}
        historyCount={0}
        favoritesCount={0}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("db.sqlite");
  });

  it("renders the history and favorites counters", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={null}
        historyCount={347}
        favoritesCount={4}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("347 history");
    expect(output).toContain("4 favorites");
  });

  it("renders the info status message", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={{ text: "ok", kind: "info" }}
        historyCount={0}
        favoritesCount={0}
      />,
    );

    const output = plain(frame);
    expect(output).toContain("ok");
  });

  it("renders an error status message in the theme's error color", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={{ text: "boom", kind: "error" }}
        historyCount={0}
        favoritesCount={0}
      />,
    );

    expect(frame).toContain(chalk.red("boom"));
  });

  it("does not color the info status message", async () => {
    const frame = await capture(
      <StatusBar
        dbPath="db.sqlite"
        theme={DEFAULT_THEME}
        statusMessage={{ text: "ok", kind: "info" }}
        historyCount={0}
        favoritesCount={0}
      />,
    );

    expect(frame).not.toContain(chalk.red("ok"));
    expect(plain(frame)).toContain("ok");
  });
});
