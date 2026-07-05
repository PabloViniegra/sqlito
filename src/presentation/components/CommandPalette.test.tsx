import chalk from "chalk";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import type { CommandDescriptor } from "../../application/commands/commandRegistry.ts";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { CommandPalette } from "./CommandPalette.tsx";
import { renderInkFrame as captureRaw } from "./renderInkFrame.ts";

chalk.level = 1;

async function capture(node: React.ReactElement): Promise<string> {
  return stripAnsi(await captureRaw(node)).replace(/\r/g, "");
}

const CMD = (name: string, description: string): CommandDescriptor => ({
  name,
  description,
});

describe("CommandPalette", () => {
  it("renders the command list with names and descriptions", async () => {
    const frame = await capture(
      <CommandPalette
        commands={[
          CMD(".tables", "List user tables"),
          CMD(".indexes", "List indexes with their table"),
        ]}
        query=""
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain(".tables");
    expect(frame).toContain("List user tables");
    expect(frame).toContain(".indexes");
    expect(frame).toContain("List indexes with their table");
  });

  it("shows the current query typed so far", async () => {
    const frame = await capture(
      <CommandPalette
        commands={[CMD(".save <name>", "Save the last query as a favorite")]}
        query="sav"
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("sav");
  });

  it("renders the empty state when there are no matches", async () => {
    const frame = await capture(
      <CommandPalette
        commands={[]}
        query="zzzzz"
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("(no matches)");
    expect(frame).toContain("Esc");
  });

  it("shows movement/run/close hints", async () => {
    const frame = await capture(
      <CommandPalette
        commands={[CMD(".tables", "List user tables")]}
        query=""
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("↑↓");
    expect(frame).toContain("Enter");
    expect(frame).toContain("Esc");
  });

  it("renders different items highlighted at different indices without error", async () => {
    const first = await capture(
      <CommandPalette
        commands={[
          CMD(".tables", "List user tables"),
          CMD(".vars", "List active session variables"),
        ]}
        query=""
        index={0}
        theme={DEFAULT_THEME}
      />,
    );
    const second = await capture(
      <CommandPalette
        commands={[
          CMD(".tables", "List user tables"),
          CMD(".vars", "List active session variables"),
        ]}
        query=""
        index={1}
        theme={DEFAULT_THEME}
      />,
    );

    expect(first).toContain(".tables");
    expect(second).toContain(".vars");
  });

  it("caps rendered rows so a large command list can't overflow the terminal (regression)", async () => {
    // A palette that renders every match unconditionally grows the live
    // region past the terminal's row count as soon as there are enough
    // registered commands. Ink then falls back to a full clearTerminal +
    // repaint on every keystroke (ink.js's shouldClearTerminalForFrame),
    // which is the "se rompe, se refresca, parpadea" flicker — reproducible
    // on any terminal, since it's pure row arithmetic.
    const commands = Array.from({ length: 30 }, (_, i) =>
      CMD(`.cmd${i}`, `Command number ${i}`),
    );

    const frame = await capture(
      <CommandPalette
        commands={commands}
        query=""
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    const rowCount = frame.split("\n").length;
    expect(rowCount).toBeLessThan(15);
  });

  it("keeps the selected command visible when its index is scrolled past the visible window (regression)", async () => {
    const commands = Array.from({ length: 30 }, (_, i) =>
      CMD(`.cmd${i}`, `Command number ${i}`),
    );

    const frame = await capture(
      <CommandPalette
        commands={commands}
        query=""
        index={29}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain(".cmd29");
  });

  it("renders the help hint in the theme's dim color", async () => {
    const frame = await captureRaw(
      <CommandPalette
        commands={[CMD(".tables", "List user tables")]}
        query=""
        index={0}
        theme={HIGH_CONTRAST_THEME}
      />,
    );
    const hint =
      "↑↓" + " move " + "   " + "Enter" + " run " + "   " + "Esc" + " close";

    expect(frame).toContain(chalk.white(hint));
  });
});
