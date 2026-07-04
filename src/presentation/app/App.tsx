import { Box, Static, useApp, useInput } from "ink";
import { useEffect, useMemo, useReducer, useRef } from "react";
import { GetAutocompleteSuggestions } from "../../application/autocomplete/GetAutocompleteSuggestions.ts";
import { LoadHistory } from "../../application/history/LoadHistory.ts";
import { SaveHistory } from "../../application/history/SaveHistory.ts";
import { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import type { Database } from "../../domain/database/Database.ts";
import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { XdgHistoryRepository } from "../../infrastructure/filesystem/XdgHistoryRepository.ts";
import { resolveXdgHistoryPath } from "../../infrastructure/filesystem/resolveXdgHistoryPath.ts";
import { AutocompletePopup } from "../components/AutocompletePopup.tsx";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { handleAutocompleteInput } from "./autocompleteInput.ts";
import { appReducer, initialState } from "./appReducer.ts";
import { handleDotCommand } from "./dotCommand.ts";

type Props = {
  db: Database;
  dbPath: string;
};

type Event = Parameters<typeof appReducer>[1];
type Dispatch = (event: Event) => void;

const STUB_SCHEMA = { listTables: (): readonly string[] => [] };

export function App({ db, dbPath }: Props) {
  const { exit } = useApp();
  const executeQuery = useMemo(() => new ExecuteQuery(db), [db]);
  const exportCsv = useMemo(() => new ExportCsv(), []);
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
    () => new GetAutocompleteSuggestions(STUB_SCHEMA),
    [],
  );
  const [state, dispatch] = useReducer(appReducer, initialState);
  const promptBeforeReverseRef = useRef<string>("");

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
        query: state.reverseSearch.query,
        entries: state.history.entries,
        dispatch,
        onCancel: () => {
          dispatch({
            type: "setPrompt",
            value: promptBeforeReverseRef.current,
          });
          dispatch({ type: "reverseSearchCancel" });
        },
      });
      return;
    }
    if (key.ctrl && input === "c") {
      db.close();
      dispatch({ type: "exit" });
      exit();
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
      const prefix = state.prompt.match(/\S+$/)?.[0] ?? "";
      dispatch({ type: "openAutocomplete", prefix });
      return;
    }
    if (key.return) {
      const sql = state.prompt.trim();
      if (sql === "") return;
      if (sql.startsWith(".")) {
        void handleDotCommand(
          sql,
          dispatch as Parameters<typeof handleDotCommand>[1],
          exportCsv,
          state.lastRowsOutcome,
        );
        dispatch({ type: "command", line: sql });
        return;
      }
      const outcome = executeQuery.execute(sql);
      dispatch({ type: "submit", outcome });
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

  const displayedPrompt = (() => {
    const { cursor, entries } = state.history;
    if (state.reverseSearch !== null) return state.prompt;
    if (cursor === 0) return state.prompt;
    return entries[cursor - 1]?.sql ?? state.prompt;
  })();
  const prefix =
    state.reverseSearch !== null ? "(reverse-i-search):" : undefined;

  const popup = state.autocomplete;
  const suggestions =
    popup === null ? [] : autocomplete.suggest(popup.prefix, {});

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

function handleReverseSearchInput(args: {
  input: string;
  key: {
    return: boolean;
    escape: boolean;
    backspace: boolean;
    delete: boolean;
    ctrl: boolean;
  };
  query: string;
  entries: readonly HistoryEntry[];
  dispatch: Dispatch;
  onCancel: () => void;
}): void {
  const { input, key, query, entries, dispatch, onCancel } = args;
  if (key.escape) {
    onCancel();
    return;
  }
  if (key.return) {
    dispatch({ type: "reverseSearchCommit" });
    return;
  }
  const nextQuery =
    key.backspace || key.delete
      ? query.slice(0, -1)
      : input && !key.ctrl
        ? query + input
        : query;
  const match = findNewestMatch(nextQuery, entries);
  dispatch({ type: "reverseSearchChange", query: nextQuery });
  dispatch({ type: "setPrompt", value: match === null ? "" : match.sql });
}

function findNewestMatch(
  query: string,
  entries: readonly HistoryEntry[],
): HistoryEntry | null {
  const haystack = query.toLowerCase();
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry !== undefined && entry.sql.toLowerCase().includes(haystack)) {
      return entry;
    }
  }
  return null;
}

function outcomeToHistoryKind(outcome: QueryOutcome): HistoryEntry["outcome"] {
  switch (outcome.kind) {
    case "rows":
      return "ok";
    case "affected":
      return "affected";
    case "side-effect":
      return "side-effect";
    case "error":
      return "ok";
  }
}
