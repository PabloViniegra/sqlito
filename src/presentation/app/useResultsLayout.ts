import {
  COMMAND_DESCRIPTORS,
  type CommandDescriptor,
} from "../../application/commands/commandRegistry.ts";
import { HEADER_LINES } from "../components/Header.tsx";
import {
  DEFAULT_PROMPT_PREFIX,
  derivePromptLayout,
  promptEffectiveWidth,
} from "../components/derivePromptLayout.ts";
import { MAX_VISIBLE_QUERIES, type AppState } from "./appReducer.ts";
import {
  countWrappedLines,
  layoutResults,
  type ResultsLayout,
} from "./resultsLayout.ts";
import { pastQueriesViewport } from "./pastQueriesViewport.ts";
import type { AppDeps } from "./useAppDeps.ts";

const COMMAND_PALETTE_MATCH_LIMIT = 10;
const COMMAND_PALETTE_CHROME = 5;

const ALL_COMMANDS: readonly CommandDescriptor[] =
  Object.values(COMMAND_DESCRIPTORS);

function filterCommands(query: string): CommandDescriptor[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return [...ALL_COMMANDS];
  return ALL_COMMANDS.filter(
    (command) =>
      command.name.toLowerCase().includes(needle) ||
      command.description.toLowerCase().includes(needle),
  );
}

export type AppLayout = {
  prefix: string | undefined;
  suggestions: ReturnType<AppDeps["autocomplete"]["suggest"]>;
  paletteMatches: readonly CommandDescriptor[];
  resultsView: ResultsLayout;
};

export function useResultsLayout({
  state,
  deps,
  columns,
  rows,
}: {
  state: AppState;
  deps: AppDeps;
  columns: number;
  rows: number;
}): AppLayout {
  const prefix =
    state.reverseSearch !== null ? "(reverse-i-search):" : undefined;

  const popup = state.autocomplete;
  const suggestions =
    popup === null
      ? []
      : deps.autocomplete.suggest(popup.prefix, popup.context);

  const palette = state.commandPalette;
  const paletteMatches =
    palette === null ? [] : filterCommands(palette.query);

  const pastQueriesView = pastQueriesViewport(
    state.pastQueries,
    MAX_VISIBLE_QUERIES,
    state.pastQueriesScrollOffset,
  );

  // analytic height budget: everything below must sum to ≤ rows so the frame
  // never exceeds the terminal (physical scroll is what breaks the layout)
  const promptLines = derivePromptLayout(
    state.prompt,
    promptEffectiveWidth(columns, (prefix ?? DEFAULT_PROMPT_PREFIX).length),
  ).rows.length;
  // StatusBar = rule + status line (+ wrapped statusMessage under paddingX/gutter)
  const statusLines =
    2 +
    (state.statusMessage === null
      ? 0
      : countWrappedLines(state.statusMessage.text, columns - 4));
  // CommandPalette chrome is 5 lines + its visible window
  const paletteLines =
    palette === null
      ? 0
      : COMMAND_PALETTE_CHROME +
        Math.max(1, Math.min(COMMAND_PALETTE_MATCH_LIMIT, paletteMatches.length));

  const resultsView = layoutResults(
    pastQueriesView.visible,
    pastQueriesView.overflowAbove,
    rows - HEADER_LINES - promptLines - statusLines - paletteLines,
  );

  return {
    prefix,
    suggestions,
    paletteMatches,
    resultsView,
  };
}
