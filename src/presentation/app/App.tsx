import { Box, Static, useApp, useInput } from "ink";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { GetAutocompleteSuggestions } from "../../application/autocomplete/GetAutocompleteSuggestions.ts";
import { LoadHistory } from "../../application/history/LoadHistory.ts";
import { SaveHistory } from "../../application/history/SaveHistory.ts";
import { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import type { Database } from "../../domain/database/Database.ts";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import { classifySideEffect } from "../../domain/sql/classifySideEffect.ts";
import { XdgHistoryRepository } from "../../infrastructure/filesystem/XdgHistoryRepository.ts";
import { resolveXdgHistoryPath } from "../../infrastructure/filesystem/resolveXdgHistoryPath.ts";
import { AutocompletePopup } from "../components/AutocompletePopup.tsx";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { deriveAutocompleteContext } from "./autocompleteContext.ts";
import { handleAutocompleteInput } from "./autocompleteInput.ts";
import { appReducer, initialState } from "./appReducer.ts";
import { handleDotCommand } from "./dotCommand.ts";
import { outcomeToHistoryKind } from "./outcomeToHistory.ts";
import { handleReverseSearchInput } from "./reverseSearchInput.ts";

type Props = {
  db: Database;
  schema: SchemaRepository;
  dbPath: string;
};

export function App({ db, schema, dbPath }: Props) {
  const { exit } = useApp();
  const executeQuery = useMemo(() => new ExecuteQuery(db), [db]);
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
  const [state, dispatch] = useReducer(appReducer, initialState);
  const promptBeforeReverseRef = useRef<string>("");

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

  useInput((input, key) => {
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
    if (key.ctrl && input === "u") {
      dispatch({ type: "clearPrompt" });
      return;
    }
    if (key.ctrl && input === "r") {
      promptBeforeReverseRef.current = state.prompt;
      dispatch({ type: "reverseSearchOpen" });
      return;
    }
    if (state.autocomplete !== null) {
      handleAutocompleteInput({
        input,
        key,
        autocomplete,
        prompt: state.prompt,
        popup: state.autocomplete,
        dispatch,
      });
      return;
    }
    if (key.tab) {
      const ac = deriveAutocompleteContext(state.prompt);
      dispatch({
        type: "openAutocomplete",
        prefix: ac.prefix,
        prefixBase: ac.prefixBase,
        context: ac.context,
      });
      return;
    }
    if (key.return) {
      const sql = state.prompt.trim();
      if (sql === "") return;
      if (sql.startsWith(".")) {
        void handleDotCommand(sql, {
          dispatch,
          exportCsv,
          schema: schemaPrettyPrint,
          lastRowsOutcome: state.lastRowsOutcome,
          onQuit: quit,
        });
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
      dispatch({ type: "historyUp" });
      return;
    }
    if (key.downArrow) {
      dispatch({ type: "historyDown" });
      return;
    }
    if (key.backspace || key.delete) {
      dispatch({ type: "backspace" });
      return;
    }
    if (input && !key.ctrl && !key.meta) {
      dispatch({ type: "setPrompt", value: state.prompt + input });
    }
  });

  const { cursor, entries } = state.history;
  const displayedPrompt =
    state.reverseSearch !== null
      ? state.prompt
      : cursor === 0
        ? state.prompt
        : (entries[cursor - 1]?.sql ?? state.prompt);
  const prefix =
    state.reverseSearch !== null ? "(reverse-i-search):" : undefined;

  const popup = state.autocomplete;
  const suggestions =
    popup === null ? [] : autocomplete.suggest(popup.prefix, popup.context);

  return (
    <Box flexDirection="column">
      <Header dbPath={dbPath} statusMessage={state.statusMessage} />
      {state.pastQueries.length > 0 && (
        <Static items={[...state.pastQueries]}>
          {(item, index) => (
            <ResultsTable key={index} outcome={item.outcome} sql={item.sql} />
          )}
        </Static>
      )}
      <Prompt value={displayedPrompt} prefix={prefix} />
      {popup !== null && (
        <AutocompletePopup suggestions={suggestions} index={popup.index} />
      )}
    </Box>
  );
}
