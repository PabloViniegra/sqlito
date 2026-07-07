import { render } from "ink";
import { PassThrough } from "node:stream";
import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import type { ReadlineState } from "../app/readline.ts";
import { Prompt } from "./Prompt.tsx";
import { renderInkFrame as capture } from "./renderInkFrame.ts";

chalk.level = 1;

function plain(frame: string): string {
  return stripAnsi(frame).replace(/\r/g, "");
}

async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

const AT_END: ReadlineState = { text: "SELECT 1", cursor: 8 };

describe("Prompt", () => {
  it("renders the default prefix in the theme's accent color", async () => {
    const frame = await capture(
      <Prompt
        readlineState={AT_END}
        viewportColumns={80}
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toContain(chalk.yellow("> "));
    expect(frame).not.toContain(chalk.cyan("> "));
  });

  it("renders prefix and value as plain text under the default theme", async () => {
    const frame = await capture(
      <Prompt
        readlineState={AT_END}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
    );

    expect(plain(frame)).toContain("> SELECT 1");
  });

  it("renders a custom prefix in the theme's accent color", async () => {
    const frame = await capture(
      <Prompt
        readlineState={{ text: "foo", cursor: 3 }}
        viewportColumns={80}
        prefix="(reverse-i-search):"
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toContain(chalk.yellow("(reverse-i-search):"));
    expect(plain(frame)).toContain("(reverse-i-search):foo");
  });

  it("does not color the typed value", async () => {
    const frame = await capture(
      <Prompt
        readlineState={AT_END}
        viewportColumns={80}
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).not.toContain(chalk.yellow("SELECT 1"));
  });

  it("empty prompt renders only the cursor glyph after the prefix", async () => {
    const frame = await capture(
      <Prompt
        readlineState={{ text: "", cursor: 0 }}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
    );

    const trimmed = plain(frame).trimEnd();
    expect(trimmed).toBe("> ▌");
  });

  it("single-line cursor at end renders the cursor glyph after the last char", async () => {
    const frame = await capture(
      <Prompt
        readlineState={{ text: "SELECT 1", cursor: 8 }}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
    );

    const trimmed = plain(frame).trimEnd();
    expect(trimmed).toBe("> SELECT 1▌");
  });

  it("single-line cursor in the middle splits text around the cursor glyph", async () => {
    const frame = await capture(
      <Prompt
        readlineState={{ text: "ac", cursor: 1 }}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
    );

    const trimmed = plain(frame).trimEnd();
    expect(trimmed).toBe("> a▌c");
  });

  it("single-line cursor at start renders the cursor glyph before the text", async () => {
    const frame = await capture(
      <Prompt
        readlineState={{ text: "abc", cursor: 0 }}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
    );

    const trimmed = plain(frame).trimEnd();
    expect(trimmed).toBe("> ▌abc");
  });

  it("repaints when a trailing space is typed (regression)", async () => {
    // Ink trims trailing whitespace per line before diffing against the
    // previous frame (build/output.js) and skips the write entirely when
    // the result is unchanged (build/ink.js). A trailing space with no
    // visible cursor after it collapses to the same line, so the keystroke
    // was silently dropped on screen. A trailing cursor glyph after the
    // text guarantees the line always ends in non-whitespace content.
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

    const instance = render(
      <Prompt
        readlineState={{ text: "SELECT", cursor: 6 }}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
      {
        stdout: stdout as unknown as NodeJS.WriteStream,
        exitOnCtrlC: false,
        patchConsole: false,
      },
    );
    await settle();
    writes.length = 0;

    instance.rerender(
      <Prompt
        readlineState={{ text: "SELECT ", cursor: 7 }}
        viewportColumns={80}
        theme={DEFAULT_THEME}
      />,
    );
    await settle();
    instance.unmount();

    expect(writes.some((w) => w.includes("SELECT"))).toBe(true);
  });
});
