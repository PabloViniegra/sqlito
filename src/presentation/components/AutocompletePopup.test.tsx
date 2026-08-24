import chalk from "chalk";
import stripAnsi from "strip-ansi";
import stringWidth from "string-width";
import { describe, expect, it } from "vitest";
import type { Suggestion } from "../../application/autocomplete/Suggestion.ts";
import {
  DEFAULT_THEME,
  HIGH_CONTRAST_THEME,
} from "../../domain/theme/Theme.ts";
import { AutocompletePopup } from "./AutocompletePopup.tsx";
import { renderInkFrame as captureRaw } from "./renderInkFrame.ts";

chalk.level = 1;

async function capture(node: React.ReactElement): Promise<string> {
  return stripAnsi(await captureRaw(node)).replace(/\r/g, "");
}

const KW = (label: string): Suggestion => ({ label, kind: "keyword" });
const TBL = (label: string): Suggestion => ({
  label,
  kind: "table",
  detail: "table",
});
const COL = (label: string, type: string): Suggestion => ({
  label,
  kind: "column",
  detail: type,
});

describe("AutocompletePopup", () => {
  it("renders the suggestion list when there are matches", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("FROM"), KW("WHERE")]}
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("SELECT");
    expect(frame).toContain("FROM");
    expect(frame).toContain("WHERE");
  });

  it("renders the empty state when there are no matches", async () => {
    const frame = await capture(
      <AutocompletePopup suggestions={[]} index={0} theme={DEFAULT_THEME} />,
    );

    expect(frame).toContain("(no matches)");
    expect(frame).toContain("Esc");
  });

  it("renders a single suggestion without crashing", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT")]}
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("SELECT");
    expect(frame).not.toContain("FROM");
  });

  it("renders table suggestions with the 'table' detail", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[TBL("users"), KW("UPDATE")]}
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("users");
    expect(frame).toContain("table");
    expect(frame).toContain("UPDATE");
  });

  it("shows movement/commit/close hints", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("SET")]}
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("↑↓");
    expect(frame).toContain("Enter");
    expect(frame).toContain("Esc");
  });

  it("renders different items at different indices without error", async () => {
    const first = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("SET"), KW("FROM")]}
        index={0}
        theme={DEFAULT_THEME}
      />,
    );
    const second = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("SET"), KW("FROM")]}
        index={1}
        theme={DEFAULT_THEME}
      />,
    );

    expect(first).toContain("SELECT");
    expect(second).toContain("SET");
  });

  it("renders column suggestions with their SQLite type as detail", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[
          COL("id", "INTEGER"),
          COL("email", "TEXT"),
          COL("created_at", "REAL"),
        ]}
        index={0}
        theme={DEFAULT_THEME}
      />,
    );

    expect(frame).toContain("id");
    expect(frame).toContain("INTEGER");
    expect(frame).toContain("email");
    expect(frame).toContain("TEXT");
  });

  it("renders the help hint with muted color tokens and bold key labels", async () => {
    const frame = await captureRaw(
      <AutocompletePopup
        suggestions={[KW("SELECT")]}
        index={0}
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toContain("↑↓");
    expect(frame).toContain("move");
    expect(frame).toContain("Enter");
    expect(frame).toContain("Esc");
    expect(frame).toMatch(/\u001b\[90m/);
    expect(frame).toMatch(/\u001b\[1m/);
  });

  it("renders non-selected table suggestions in the theme's muted color", async () => {
    const frame = await captureRaw(
      <AutocompletePopup
        suggestions={[TBL("users"), KW("SELECT")]}
        index={1}
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toMatch(/\u001b\[90m.*users/);
  });

  it("renders the empty state hint in the theme's muted color", async () => {
    const frame = await captureRaw(
      <AutocompletePopup
        suggestions={[]}
        index={0}
        theme={HIGH_CONTRAST_THEME}
      />,
    );

    expect(frame).toMatch(/\u001b\[90m.*\(no matches\)/);
  });

  it("uses a compact one-line presentation when vertical space is tight", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[TBL("a very long table name")]}
        index={0}
        theme={DEFAULT_THEME}
        columns={30}
        maxLines={4}
      />,
    );

    const line = frame.replace(/\n+$/, "");
    expect(line.split("\n")).toHaveLength(1);
    expect(stringWidth(line)).toBeLessThanOrEqual(30);
    expect(line).toContain("COMPLETE");
  });

  it("caps every chrome line at a very narrow width", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[KW("SELECT"), KW("FROM"), KW("WHERE")]}
        index={0}
        theme={DEFAULT_THEME}
        columns={15}
        maxLines={5}
      />,
    );

    expect(frame.replace(/\n+$/, "").split("\n")).toHaveLength(5);
    for (const line of frame.split("\n")) {
      expect(stringWidth(line)).toBeLessThanOrEqual(15);
    }
  });

  it("caps the empty state at its physical line budget", async () => {
    const frame = await capture(
      <AutocompletePopup
        suggestions={[]}
        index={0}
        theme={DEFAULT_THEME}
        columns={5}
        maxLines={5}
      />,
    );

    expect(frame.replace(/\n+$/, "").split("\n")).toHaveLength(5);
    for (const line of frame.split("\n")) {
      expect(stringWidth(line)).toBeLessThanOrEqual(5);
    }
  });
});
