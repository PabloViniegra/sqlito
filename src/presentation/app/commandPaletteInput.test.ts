import { describe, expect, it, vi } from "vitest";
import { COMMAND_DESCRIPTORS } from "../../application/commands/commandRegistry.ts";
import type { AppEvent, CommandPaletteState } from "./appReducer.ts";
import type { DotCommandDeps } from "./dotCommand.ts";
import { makeDotCommandDeps } from "./dotCommandDeps.fixture.ts";
import {
  filterCommands,
  handleCommandPaletteInput,
} from "./commandPaletteInput.ts";
import type { OverlayKey } from "./overlayKey.ts";

const NO_KEY: OverlayKey = {
  return: false,
  escape: false,
  tab: false,
  upArrow: false,
  downArrow: false,
  backspace: false,
  delete: false,
  ctrl: false,
  meta: false,
};

function makeDeps(dispatch: (event: AppEvent) => void): DotCommandDeps {
  return makeDotCommandDeps({ dispatch });
}

describe("filterCommands", () => {
  it("returns every command from the registry when the query is empty", () => {
    const result = filterCommands("");

    expect(result).toEqual(Object.values(COMMAND_DESCRIPTORS));
  });

  it("filters by a substring of the command name", () => {
    const result = filterCommands(".tables");

    expect(result).toEqual([COMMAND_DESCRIPTORS.tables]);
  });

  it("filters by a substring of the command description", () => {
    const result = filterCommands("session variable");

    expect(result).toEqual([
      COMMAND_DESCRIPTORS.set,
      COMMAND_DESCRIPTORS.unset,
      COMMAND_DESCRIPTORS.vars,
    ]);
  });

  it("matches case-insensitively", () => {
    const result = filterCommands("TABLES");

    expect(result).toEqual([
      COMMAND_DESCRIPTORS.tables,
      COMMAND_DESCRIPTORS.schema,
    ]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = filterCommands("zzzzz");

    expect(result).toEqual([]);
  });
});

describe("handleCommandPaletteInput", () => {
  it("closes the palette on escape", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, escape: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([{ type: "closeCommandPalette" }]);
  });

  it("appends typed text to the query", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "sa", index: 0 };

    handleCommandPaletteInput({
      input: "v",
      key: NO_KEY,
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([{ type: "setCommandPaletteQuery", query: "sav" }]);
  });

  it("does not append control input held with ctrl/meta", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "sa", index: 0 };

    handleCommandPaletteInput({
      input: "v",
      key: { ...NO_KEY, ctrl: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([]);
  });

  it("removes the last character of the query on backspace", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "sav", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, backspace: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([{ type: "setCommandPaletteQuery", query: "sa" }]);
  });

  it("removes the last character of the query on delete", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "sav", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, delete: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([{ type: "setCommandPaletteQuery", query: "sa" }]);
  });

  it("moves the selection down (↓) using the filtered count", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, downArrow: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([
      {
        type: "moveCommandPalette",
        delta: 1,
        count: filterCommands("").length,
      },
    ]);
  });

  it("moves the selection up (↑) using the filtered count", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "sav", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, upArrow: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([
      {
        type: "moveCommandPalette",
        delta: -1,
        count: filterCommands("sav").length,
      },
    ]);
  });

  it("dispatches command + closes on enter, then reports the command result", async () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: ".tables", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, return: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });
    await vi.waitFor(() => expect(events).toHaveLength(5));

    expect(events).toEqual([
      { type: "setRunning", running: true },
      { type: "command", line: ".tables" },
      { type: "closeCommandPalette" },
      { type: "setStatus", status: { text: "posts\nusers", kind: "info" } },
      { type: "setRunning", running: false },
    ]);
  });

  it("strips the placeholder args from the descriptor name before running it", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: ".set", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, return: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([
      {
        type: "setStatus",
        status: { text: "set: missing name", kind: "error" },
      },
      { type: "command", line: ".set" },
      { type: "closeCommandPalette" },
    ]);
  });

  it("closes without running anything when there is no match at the index", () => {
    const events: AppEvent[] = [];
    const dispatch = (event: AppEvent) => events.push(event);
    const palette: CommandPaletteState = { query: "zzzzz", index: 0 };

    handleCommandPaletteInput({
      input: "",
      key: { ...NO_KEY, return: true },
      palette,
      dispatch,
      deps: makeDeps(dispatch),
    });

    expect(events).toEqual([{ type: "closeCommandPalette" }]);
  });
});
