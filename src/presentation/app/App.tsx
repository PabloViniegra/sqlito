import { Box, Static, useApp, useInput, useStdout } from "ink";
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
import { ResultsTable } from "../components/ResultsTable.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { usePromptInput } from "../hooks/usePromptInput.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";
import { deriveAutocompleteContext } from "./autocompleteContext.ts";
import { handleAutocompleteInput } from "./autocompleteInput.ts";
import { appReducer, initialState } from "./appReducer.ts";
import { clearScreen } from "./clearScreen.ts";
import {
  filterCommands,
  handleCommandPaletteInput,
} from "./commandPaletteInput.ts";
import { handleDotCommand, type DotCommandDeps } from "./dotCommand.ts";
import { outcomeToHistoryKind } from "./outcomeToHistory.ts";
import { promptKeymapReadlineIntent } from "./promptKeymap.ts";
import { recallHistory } from "./recallHistory.ts";
import type { ReadlineState } from "./readline.ts";
import { handleReverseSearchInput } from "./reverseSearchInput.ts";

type Props = {
  db: Database;
  schema: SchemaRepository;
  dbPath: string;
};

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
    lastRowsOutcome: state.lastRowsOutcome,
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

  const navigateHistory = useCallback(
    (direction: "up" | "down") => {
      const result = recallHistory({
        text: state.prompt.text,
        cursor: state.prompt.cursor,
        viewportColumns: columns,
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
              ? { type: "MoveUp", viewportColumns: columns }
              : { type: "MoveDown", viewportColumns: columns },
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
      columns,
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
      if (stdout !== undefined) clearScreen(stdout);
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
    if (key.ctrl && input === "r") {
      promptBeforeReverseRef.current = state.prompt.text;
      dispatch({ type: "reverseSearchOpen" });
      return;
    }
    if (key.ctrl && input === "p") {
      dispatch({ type: "openCommandPalette" });
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
      }
      return;
    }
    if (key.upArrow) {
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
      dispatch({
        type: "readline",
        intent:
          input.length === 1
            ? { type: "Insert", ch: input }
            : { type: "Paste", text: input },
      });
    }
  });

  const displayedPrompt =
    state.reverseSearch !== null || historyCursor === 0
      ? state.prompt.text
      : (state.history.entries[historyCursor - 1]?.sql ?? state.prompt.text);
  const prefix =
    state.reverseSearch !== null ? "(reverse-i-search):" : undefined;

  const popup = state.autocomplete;
  const suggestions =
    popup === null ? [] : autocomplete.suggest(popup.prefix, popup.context);

  const palette = state.commandPalette;
  const paletteMatches = palette === null ? [] : filterCommands(palette.query);

  return (
    <Box flexDirection="column" height={rows}>
      <Header dbPath={dbPath} theme={state.theme} />
      {state.pastQueries.length > 0 && (
        <Static items={[...state.pastQueries]}>
          {(item, index) => (
            <ResultsTable
              key={index}
              outcome={item.outcome}
              sql={item.sql}
              theme={state.theme}
            />
          )}
        </Static>
      )}
      <Box flexGrow={1} />
      <Prompt
        readlineState={{
          text: displayedPrompt,
          cursor: displayedPrompt.length,
        }}
        viewportColumns={columns}
        prefix={prefix}
        theme={state.theme}
      />
      {popup !== null && (
        <AutocompletePopup
          suggestions={suggestions}
          index={popup.index}
          theme={state.theme}
        />
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
      />
    </Box>
  );
}
