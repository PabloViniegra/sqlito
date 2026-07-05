import { render } from "ink";
import { PassThrough } from "node:stream";
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

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
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

  it("repaints when a trailing space is typed (regression)", async () => {
    // Ink trims trailing whitespace per line before diffing against the
    // previous frame (build/output.js) and skips the write entirely when
    // the result is unchanged (build/ink.js). A trailing space with no
    // visible cursor after it collapses to the same line, so the keystroke
    // was silently dropped on screen. A trailing cursor glyph after `value`
    // guarantees the line always ends in non-whitespace content.
    const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
      columns: number;
    };
    stdout.columns = 80;
    (stdout as unknown as { isTTY: boolean }).isTTY = true;
    const writes: string[] = [];
    stdout.write = ((chunk: string | Uint8Array): boolean => {
      writes.push(chunk.toString());
      return true;
    }) as typeof stdout.write;

    const instance = render(<Prompt value="SELECT" theme={DEFAULT_THEME} />, {
      stdout: stdout as unknown as NodeJS.WriteStream,
      exitOnCtrlC: false,
      patchConsole: false,
    });
    await settle();
    writes.length = 0;

    instance.rerender(<Prompt value="SELECT " theme={DEFAULT_THEME} />);
    await settle();
    instance.unmount();

    expect(writes.some((w) => w.includes("SELECT"))).toBe(true);
  });
});
