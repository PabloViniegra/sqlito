import {
  COMMAND_DESCRIPTORS,
  type CommandDescriptor,
} from "../../application/commands/commandRegistry.ts";
import type { AppEvent, CommandPaletteState } from "./appReducer.ts";
import { handleDotCommand, type DotCommandDeps } from "./dotCommand.ts";

const ALL_COMMANDS: readonly CommandDescriptor[] =
  Object.values(COMMAND_DESCRIPTORS);

export function filterCommands(query: string): CommandDescriptor[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...ALL_COMMANDS];
  return ALL_COMMANDS.filter(
    (command) =>
      command.name.toLowerCase().includes(needle) ||
      command.description.toLowerCase().includes(needle),
  );
}

type Dispatch = (event: AppEvent) => void;

export type Key = {
  return: boolean;
  escape: boolean;
  tab: boolean;
  upArrow: boolean;
  downArrow: boolean;
  backspace: boolean;
  delete: boolean;
  ctrl: boolean;
  meta: boolean;
};

export function handleCommandPaletteInput(args: {
  input: string;
  key: Key;
  palette: CommandPaletteState;
  dispatch: Dispatch;
  deps: DotCommandDeps;
}): void {
  const { input, key, palette, dispatch, deps } = args;
  if (key.escape) {
    dispatch({ type: "closeCommandPalette" });
    return;
  }
  const matches = filterCommands(palette.query);
  if (key.return) {
    const picked = matches[palette.index];
    if (picked === undefined) {
      dispatch({ type: "closeCommandPalette" });
      return;
    }
    const base = picked.name.split(/\s+/)[0];
    void handleDotCommand(base, deps);
    dispatch({ type: "command", line: base });
    dispatch({ type: "closeCommandPalette" });
    return;
  }
  if (key.upArrow) {
    dispatch({ type: "moveCommandPalette", delta: -1, count: matches.length });
    return;
  }
  if (key.downArrow) {
    dispatch({ type: "moveCommandPalette", delta: 1, count: matches.length });
    return;
  }
  if (key.backspace || key.delete) {
    dispatch({
      type: "setCommandPaletteQuery",
      query: palette.query.slice(0, -1),
    });
    return;
  }
  if (input && !key.ctrl && !key.meta) {
    dispatch({
      type: "setCommandPaletteQuery",
      query: palette.query + input,
    });
  }
}
