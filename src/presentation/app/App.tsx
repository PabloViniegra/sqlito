// Slice → user-story traceability (v1.1 "fluidity" chain, PRD #31).
// Each wiring in this file exists to satisfy the user story listed below;
// before deleting code that "looks unused", check the slice that owns it.
//   #32 alternate-screen              → launch / exit feel like one app, no scrollback pollution
//   #33 useViewportSize + responsive   → prompt stays reachable, results scroll independently
//   #34 wrap prompt + ↑/↓ cursor rows  → long queries don't truncate; ↑/↓ navigate within the wrapped prompt
//   #35 readline reducer + Prompt      → insert / delete / move are predictable across every key
//   #36 history recall at boundary     → ↑ on the first visual row pulls prior SQL, not just the prior line
//   #37 kill + word-skip               → editing a long query feels like a shell
//   #38 Ctrl+L clear + re-anchor       → a cluttered session is one keystroke from a fresh slate
//   #39 split useInput precedence      → Tab and Ctrl+P never collide; overlays own their own input
//   #40 memoize + render-counter       → typing stays responsive on large result sets
//   #41 e2e smoke + bench gate         → every key sequence has at least one automated proof; cold-start regressions are caught before merge
import { Box, Text, useApp, useInput, usePaste, useStdout } from "ink";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { GetAutocompleteSuggestions } from "../../application/autocomplete/GetAutocompleteSuggestions.ts";
import { ListFavorites } from "../../application/favorites/ListFavorites.ts";
import { SaveFavorite } from "../../application/favorites/SaveFavorite.ts";
import { RunFavorite } from "../../application/favorites/RunFavorite.ts";
import { ForgetFavorite } from "../../application/favorites/ForgetFavorite.ts";
import { LoadHistory } from "../../application/history/LoadHistory.ts";
import { SaveHistory } from "../../application/history/SaveHistory.ts";
import { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import { RunExplain } from "../../application/queries/RunExplain.ts";
import { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import { LoadTheme } from "../../application/theme/LoadTheme.ts";
import { SwitchTheme } from "../../application/theme/SwitchTheme.ts";
import { SessionVariables } from "../../application/variables/SessionVariables.ts";
import type { Database } from "../../domain/database/Database.ts";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import { classifySideEffect } from "../../domain/sql/classifySideEffect.ts";
import { XdgHistoryRepository } from "../../infrastructure/filesystem/XdgHistoryRepository.ts";
import { resolveXdgHistoryPath } from "../../infrastructure/filesystem/resolveXdgHistoryPath.ts";
import { XdgFavoritesRepository } from "../../infrastructure/filesystem/XdgFavoritesRepository.ts";
import { resolveXdgFavoritesPath } from "../../infrastructure/filesystem/resolveXdgFavoritesPath.ts";
import { XdgThemeRepository } from "../../infrastructure/filesystem/XdgThemeRepository.ts";
import { resolveXdgConfigPath } from "../../infrastructure/filesystem/resolveXdgConfigPath.ts";
import { AutocompletePopup } from "../components/AutocompletePopup.tsx";
import { CommandPalette } from "../components/CommandPalette.tsx";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import {
  DEFAULT_PROMPT_PREFIX,
  derivePromptLayout,
  promptEffectiveWidth,
} from "../components/derivePromptLayout.ts";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { usePromptInput } from "../hooks/usePromptInput.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";
import { deriveAutocompleteContext } from "./autocompleteContext.ts";
import { handleAutocompleteInput } from "./autocompleteInput.ts";
import { appReducer, initialState, MAX_VISIBLE_QUERIES } from "./appReducer.ts";
import { clearScreen } from "./clearScreen.ts";
import {
  filterCommands,
  handleCommandPaletteInput,
} from "./commandPaletteInput.ts";
import { handleDotCommand, type DotCommandDeps } from "./dotCommand.ts";
import { outcomeToHistoryKind } from "./outcomeToHistory.ts";
import { promptKeymapReadlineIntent } from "./promptKeymap.ts";
import { recallError } from "./recallError.ts";
import { recallHistory } from "./recallHistory.ts";
import type { ReadlineState } from "./readline.ts";
import { handleReverseSearchInput } from "./reverseSearchInput.ts";
import { pastQueriesViewport } from "./pastQueriesViewport.ts";
import { countWrappedLines, layoutResults } from "./resultsLayout.ts";

type Props = {
  db: Database;
  schema: SchemaRepository;
  dbPath: string;
};

// 4-line mascot + 2 border rows in Header.tsx
const HEADER_HEIGHT = 6;

export function App({ db, schema, dbPath }: Props) {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const { rows, columns } = useViewportSize();
  const sessionVars = useMemo(() => new SessionVariables(), []);
  const executeQuery = useMemo(
    () => new ExecuteQuery(db, () => sessionVars.entries()),
    [db, sessionVars],
  );
  const runExplain = useMemo(
    () => new RunExplain(executeQuery),
    [executeQuery],
  );
  const exportCsv = useMemo(() => new ExportCsv(), []);
  const schemaPrettyPrint = useMemo(() => new SchemaPrettyPrint(db), [db]);
  const historyRepo = useMemo(
    () => new XdgHistoryRepository(resolveXdgHistoryPath()),
    [],
  );
  const loadHistory = useMemo(
    () => new LoadHistory(historyRepo),
    [historyRepo],
  );
  const saveHistory = useMemo(
    () => new SaveHistory(historyRepo),
    [historyRepo],
  );
  const autocomplete = useMemo(
    () => new GetAutocompleteSuggestions(schema),
    [schema],
  );
  const favoritesRepo = useMemo(
    () => new XdgFavoritesRepository(resolveXdgFavoritesPath()),
    [],
  );
  const saveFavorite = useMemo(
    () => new SaveFavorite(favoritesRepo),
    [favoritesRepo],
  );
  const listFavorites = useMemo(
    () => new ListFavorites(favoritesRepo),
    [favoritesRepo],
  );
  const runFavorite = useMemo(
    () => new RunFavorite(favoritesRepo),
    [favoritesRepo],
  );
  const forgetFavorite = useMemo(
    () => new ForgetFavorite(favoritesRepo),
    [favoritesRepo],
  );
  const themeRepo = useMemo(
    () => new XdgThemeRepository(resolveXdgConfigPath()),
    [],
  );
  const loadTheme = useMemo(() => new LoadTheme(themeRepo), [themeRepo]);
  const switchTheme = useMemo(() => new SwitchTheme(themeRepo), [themeRepo]);
  const [state, dispatch] = useReducer(appReducer, initialState);
  const promptBeforeReverseRef = useRef<string>("");
  const lastSuccessfulSqlRef = useRef<string>("");
  const lastFailedSqlRef = useRef<string>("");
  const stashedPromptRef = useRef<ReadlineState | null>(null);
  const [historyCursor, setHistoryCursor] = useState(0);

  const quit = useCallback(() => {
    db.close();
    dispatch({ type: "exit" });
    exit();
  }, [db, exit]);

  useEffect(() => {
    schema.refresh();
  }, [schema]);

  useEffect(() => {
    let cancelled = false;
    void loadHistory.load().then((entries) => {
      if (!cancelled) dispatch({ type: "loadHistory", entries });
    });
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  useEffect(() => {
    let cancelled = false;
    void listFavorites.list().then((favorites) => {
      if (!cancelled) dispatch({ type: "loadFavorites", favorites });
    });
    return () => {
      cancelled = true;
    };
  }, [listFavorites]);

  useEffect(() => {
    let cancelled = false;
    void loadTheme.load().then((theme) => {
      if (!cancelled) dispatch({ type: "setTheme", theme });
    });
    return () => {
      cancelled = true;
    };
  }, [loadTheme]);

  const dotCommandDeps: DotCommandDeps = {
    dispatch,
    exportCsv,
    schema: schemaPrettyPrint,
    lastOutcome: state.lastOutcome,
    onQuit: quit,
    sessionVars,
    variables: state.variables,
    runExplain,
    lastSql: lastSuccessfulSqlRef.current,
    showResult: (resultSql, outcome) =>
      dispatch({
        type: "recordQuery",
        entry: {
          sql: resultSql,
          outcome: outcomeToHistoryKind(outcome),
          timestamp: Date.now(),
        },
        outcome,
      }),
    saveFavorite,
    runFavorite,
    forgetFavorite,
    favorites: state.favorites,
    switchTheme,
  };

  const effectiveColumns = promptEffectiveWidth(
    columns,
    DEFAULT_PROMPT_PREFIX.length,
  );

  const navigateHistory = useCallback(
    (direction: "up" | "down") => {
      const result = recallHistory({
        text: state.prompt.text,
        cursor: state.prompt.cursor,
        viewportColumns: effectiveColumns,
        entries: state.history.entries,
        historyCursor,
        stashedPrompt: stashedPromptRef.current,
        direction,
      });
      if (result.kind === "skip") {
        dispatch({
          type: "readline",
          intent:
            direction === "up"
              ? { type: "MoveUp", viewportColumns: effectiveColumns }
              : { type: "MoveDown", viewportColumns: effectiveColumns },
        });
        return;
      }
      if (result.kind === "apply") {
        dispatch({
          type: "readline",
          intent: {
            type: "Reset",
            text: result.prompt.text,
            cursor: result.prompt.cursor,
          },
        });
        setHistoryCursor(result.nextHistoryCursor);
        stashedPromptRef.current = result.nextStashedPrompt;
      }
    },
    [
      effectiveColumns,
      historyCursor,
      state.history.entries,
      state.prompt.cursor,
      state.prompt.text,
    ],
  );

  const overlayActive =
    state.autocomplete !== null ||
    state.commandPalette !== null ||
    state.reverseSearch !== null;

  useInput((input, key) => {
    if (key.ctrl && input === "l") {
      // Ink only writes a frame when it differs from the last one it
      // rendered, so a raw terminal clear needs a real state change behind
      // it or the screen stays blank until something else touches state.
      if (stdout !== undefined) clearScreen(stdout);
      dispatch({ type: "setStatus", status: null });
      return;
    }
    if (key.pageUp && state.pastQueries.length > 0) {
      dispatch({ type: "pastQueriesPageUp" });
      return;
    }
    if (key.pageDown && state.pastQueries.length > 0) {
      dispatch({ type: "pastQueriesPageDown" });
      return;
    }
    if (state.reverseSearch !== null) {
      handleReverseSearchInput({
        input,
        key,
        promptBeforeReverse: promptBeforeReverseRef.current,
        query: state.reverseSearch.query,
        entries: state.history.entries,
        dispatch,
      });
      return;
    }
    if (key.ctrl && input === "c") {
      quit();
      return;
    }
    if (state.commandPalette !== null) {
      handleCommandPaletteInput({
        input,
        key,
        palette: state.commandPalette,
        dispatch,
        deps: dotCommandDeps,
      });
      return;
    }
    if (state.autocomplete !== null) {
      handleAutocompleteInput({
        input,
        key,
        autocomplete,
        prompt: state.prompt.text,
        popup: state.autocomplete,
        dispatch,
      });
      return;
    }
    if (key.ctrl && input === "r") {
      promptBeforeReverseRef.current = state.prompt.text;
      dispatch({ type: "reverseSearchOpen" });
      return;
    }
    if (key.ctrl && input === "p") {
      dispatch({ type: "openCommandPalette" });
      return;
    }
    if (key.tab) {
      const ac = deriveAutocompleteContext(state.prompt.text);
      dispatch({
        type: "openAutocomplete",
        prefix: ac.prefix,
        prefixBase: ac.prefixBase,
        context: ac.context,
      });
    }
  });

  usePromptInput(overlayActive, (input, key) => {
    const promptIntent = promptKeymapReadlineIntent(input, key);
    if (promptIntent !== null) {
      dispatch({ type: "readline", intent: promptIntent });
      return;
    }
    if (key.return) {
      const sql = state.prompt.text.trim();
      if (sql === "") return;
      setHistoryCursor(0);
      if (sql.startsWith(".")) {
        void handleDotCommand(sql, dotCommandDeps);
        dispatch({ type: "command", line: sql });
        return;
      }
      const outcome = executeQuery.execute(sql);
      dispatch({ type: "submit", outcome });
      if (outcome.kind === "side-effect" && classifySideEffect(sql)) {
        schema.refresh();
      }
      if (outcome.kind !== "error") {
        const timestamp = Date.now();
        lastSuccessfulSqlRef.current = sql;
        dispatch({
          type: "recordQuery",
          entry: { sql, outcome: outcomeToHistoryKind(outcome), timestamp },
          outcome,
        });
        void saveHistory.save(sql, outcome, timestamp);
        // a successful query invalidates the prior failure's recall slot — only the most recent error is recallable
        lastFailedSqlRef.current = "";
      } else {
        lastFailedSqlRef.current = sql;
        dispatch({ type: "recordError", sql, outcome });
      }
      return;
    }
    if (key.upArrow) {
      const recalled = recallError({
        prompt: state.prompt,
        failedSql: lastFailedSqlRef.current,
        direction: "up",
      });
      if (recalled !== null) {
        dispatch({
          type: "readline",
          intent: {
            type: "Reset",
            text: recalled.text,
            cursor: recalled.cursor,
          },
        });
        setHistoryCursor(0);
        stashedPromptRef.current = null;
        return;
      }
      navigateHistory("up");
      return;
    }
    if (key.downArrow) {
      navigateHistory("down");
      return;
    }
    if (key.leftArrow) {
      dispatch({ type: "readline", intent: { type: "MoveLeft" } });
      return;
    }
    if (key.rightArrow) {
      dispatch({ type: "readline", intent: { type: "MoveRight" } });
      return;
    }
    if (key.home) {
      dispatch({ type: "readline", intent: { type: "MoveHome" } });
      return;
    }
    if (key.end) {
      dispatch({ type: "readline", intent: { type: "MoveEnd" } });
      return;
    }
    if (key.backspace) {
      dispatch({ type: "readline", intent: { type: "Backspace" } });
      return;
    }
    if (key.delete) {
      dispatch({ type: "readline", intent: { type: "Delete" } });
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      dispatch({ type: "readline", intent: { type: "Insert", ch: input } });
    }
  });

  usePaste(
    (text) => {
      dispatch({ type: "readline", intent: { type: "Paste", text } });
    },
    { isActive: !overlayActive },
  );

  const prefix =
    state.reverseSearch !== null ? "(reverse-i-search):" : undefined;

  const popup = state.autocomplete;
  const suggestions =
    popup === null ? [] : autocomplete.suggest(popup.prefix, popup.context);

  const palette = state.commandPalette;
  const paletteMatches = palette === null ? [] : filterCommands(palette.query);

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
  // CommandPalette chrome is 5 lines + its visible window (MAX_VISIBLE = 10)
  const paletteLines =
    palette === null ? 0 : 5 + Math.max(1, Math.min(10, paletteMatches.length));
  const resultsView = layoutResults(
    pastQueriesView.visible,
    pastQueriesView.overflowAbove,
    rows - HEADER_HEIGHT - promptLines - statusLines - paletteLines,
  );

  return (
    <Box flexDirection="column" height={rows}>
      <Header dbPath={dbPath} theme={state.theme} />
      <Box flexGrow={1} />
      {resultsView.expanded !== null && (
        <Box
          flexDirection="column"
          flexShrink={1}
          overflowY="hidden"
          minHeight={0}
        >
          {resultsView.showIndicator ? (
            <Text color={state.theme.tokens.muted}>
              ↑ {resultsView.hiddenAbove} more · PgUp
            </Text>
          ) : null}
          {resultsView.collapsed.map((item) => (
            <ResultsTable
              key={`${item.sql}-${state.pastQueries.indexOf(item)}`}
              outcome={item.outcome}
              sql={item.sql}
              theme={state.theme}
              columns={columns}
              variant="compact"
            />
          ))}
          <ResultsTable
            key={`${resultsView.expanded.sql}-${state.pastQueries.indexOf(resultsView.expanded)}`}
            outcome={resultsView.expanded.outcome}
            sql={resultsView.expanded.sql}
            theme={state.theme}
            columns={columns}
            maxLines={resultsView.expandedMaxLines}
          />
        </Box>
      )}
      <Prompt
        readlineState={state.prompt}
        viewportColumns={columns}
        prefix={prefix}
        theme={state.theme}
      />
      {popup !== null && (
        <Box position="absolute" width={columns} bottom={3}>
          <AutocompletePopup
            suggestions={suggestions}
            index={popup.index}
            theme={state.theme}
          />
        </Box>
      )}
      {palette !== null && (
        <CommandPalette
          commands={paletteMatches}
          query={palette.query}
          index={palette.index}
          theme={state.theme}
        />
      )}
      <StatusBar
        dbPath={dbPath}
        theme={state.theme}
        statusMessage={state.statusMessage}
        historyCount={state.history.entries.length}
        favoritesCount={state.favorites.length}
        columns={columns}
        lastOutcome={state.lastOutcome}
      />
    </Box>
  );
}
