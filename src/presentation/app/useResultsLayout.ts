import {
  COMMAND_DESCRIPTORS,
  type CommandDescriptor,
} from "../../application/commands/commandRegistry.ts";
import {
  DEFAULT_PROMPT_PREFIX,
  derivePromptLayout,
  promptLineCount,
  promptPrefixForViewport,
  promptEffectiveWidth,
} from "../components/derivePromptLayout.ts";
import { headerLines } from "../layout/headerLayout.ts";
import {
  OVERLAY_CHROME_LINES,
  overlayLineCount,
} from "../layout/overlayLayout.ts";
import { normalizeTerminalColumns } from "../layout/terminalDimensions.ts";
import { MAX_VISIBLE_QUERIES, type AppState } from "./appReducer.ts";
import {
  countWrappedLines,
  layoutResults,
  type ResultsLayout,
} from "./resultsLayout.ts";
import { pastQueriesViewport } from "./pastQueriesViewport.ts";
import type { AppDeps } from "./useAppDeps.ts";
import stringWidth from "string-width";

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
  autocompleteMaxLines: number;
  paletteMaxLines: number;
  statusMaxLines: number;
  compactStatus: boolean;
  headerVisible: boolean;
  statusVisible: boolean;
  promptVisible: boolean;
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
  const terminalWidth = normalizeTerminalColumns(columns);
  const prefix =
    state.reverseSearch !== null ? "(reverse-i-search):" : undefined;

  const popup = state.autocomplete;
  const suggestions =
    popup === null
      ? []
      : deps.autocomplete.suggest(popup.prefix, popup.context);

  const palette = state.commandPalette;
  const paletteMatches = palette === null ? [] : filterCommands(palette.query);

  const pastQueriesView = pastQueriesViewport(
    state.pastQueries,
    MAX_VISIBLE_QUERIES,
    state.pastQueriesScrollOffset,
  );

  const promptPrefix = promptPrefixForViewport(
    prefix ?? DEFAULT_PROMPT_PREFIX,
    terminalWidth,
  );
  const promptLayout = derivePromptLayout(
    state.prompt,
    promptEffectiveWidth(terminalWidth, stringWidth(promptPrefix)),
  );
  const promptLines = promptLineCount(
    promptLayout,
    terminalWidth,
    promptPrefix,
  );
  const overlayActive = palette !== null || popup !== null;
  const inputLines = overlayActive ? 1 : promptLines;
  const nominalHeaderLines = headerLines(terminalWidth);
  const headerVisible = rows >= nominalHeaderLines + inputLines;
  const headerSlotLines = headerVisible ? nominalHeaderLines : 0;
  const availableStatusLines = Math.max(0, rows - headerSlotLines - inputLines);
  const baseStatusLines = availableStatusLines > 0 ? 2 : 0;
  const desiredStatusLines =
    baseStatusLines +
    (state.statusMessage === null
      ? 0
      : countWrappedLines(state.statusMessage.text, terminalWidth - 4));
  const statusMaxLines = Math.min(availableStatusLines, desiredStatusLines);
  const statusVisible = statusMaxLines > 0;
  const compactStatus = statusMaxLines === 1;
  const statusLines = statusMaxLines;
  const fixedLines = headerSlotLines + statusLines;
  const paletteMaxLines =
    palette === null
      ? 0
      : overlayLineCount(
          paletteMatches.length,
          OVERLAY_CHROME_LINES.commandPalette,
          Math.max(0, rows - fixedLines),
        );
  const autocompleteWithPromptLines = Math.max(
    0,
    rows - fixedLines - promptLines,
  );
  const autocompleteReplacesPrompt =
    popup !== null && palette === null && autocompleteWithPromptLines < 1;
  const autocompleteMaxLines =
    popup === null || palette !== null
      ? 0
      : overlayLineCount(
          suggestions.length,
          OVERLAY_CHROME_LINES.autocomplete,
          autocompleteReplacesPrompt
            ? Math.max(0, rows - fixedLines)
            : autocompleteWithPromptLines,
        );
  const promptVisible = palette === null && !autocompleteReplacesPrompt;
  const promptSlotLines = promptVisible
    ? promptLines
    : palette === null
      ? 0
      : paletteMaxLines;

  const resultsView = layoutResults(
    pastQueriesView.visible,
    pastQueriesView.overflowAbove,
    rows - fixedLines - promptSlotLines - autocompleteMaxLines,
  );

  return {
    prefix,
    suggestions,
    paletteMatches,
    autocompleteMaxLines,
    paletteMaxLines,
    statusMaxLines,
    compactStatus,
    headerVisible,
    statusVisible,
    promptVisible,
    resultsView,
  };
}
