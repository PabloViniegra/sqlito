import { useInput, useStdout, usePaste } from "ink";
import { useRef, type MutableRefObject } from "react";
import { historyKindFor } from "../../domain/sql/historyKind.ts";
import { classifySideEffect } from "../../domain/sql/classifySideEffect.ts";
import { usePromptInput } from "../hooks/usePromptInput.ts";
import type { AppState } from "./appReducer.ts";
import { deriveAutocompleteContext } from "./autocompleteContext.ts";
import { handleAutocompleteInput } from "./autocompleteInput.ts";
import { clearScreen } from "./clearScreen.ts";
import { handleCommandPaletteInput } from "./commandPaletteInput.ts";
import { handleDotCommand, type AppDispatch } from "./dotCommand.ts";
import { promptKeymapReadlineIntent } from "./promptKeymap.ts";
import { recallError } from "./recallError.ts";
import { handleReverseSearchInput } from "./reverseSearchInput.ts";
import type { ReadlineState } from "./readline.ts";
import { useDotCommandDeps } from "./useDotCommandDeps.ts";
import { useNavigateHistory } from "./useNavigateHistory.ts";
import type { AppDeps } from "./useAppDeps.ts";

export function useAppKeybindings({
  deps,
  state,
  dispatch,
}: {
  deps: AppDeps;
  state: AppState;
  dispatch: AppDispatch;
}): void {
  const { stdout } = useStdout();

  const promptBeforeReverseRef = useRef<string>("");
  const lastSuccessfulSqlRef = useRef<string>("");
  const lastFailedSqlRef = useRef<string>("");
  const stashedPromptRef: MutableRefObject<ReadlineState | null> = useRef<
    ReadlineState | null
  >(null);

  const dotCommandDeps = useDotCommandDeps({
    deps,
    state,
    dispatch,
    lastSuccessfulSqlRef,
  });
  const { navigateHistory, setHistoryCursor } = useNavigateHistory({
    state,
    dispatch,
    stashedPromptRef,
  });

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
      deps.quit();
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
        autocomplete: deps.autocomplete,
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
      const outcome = deps.executeQuery.execute(sql);
      dispatch({ type: "submit", outcome });
      if (outcome.kind === "side-effect" && classifySideEffect(sql)) {
        deps.schema.refresh();
      }
      if (outcome.kind !== "error") {
        const timestamp = Date.now();
        lastSuccessfulSqlRef.current = sql;
        dispatch({
          type: "recordQuery",
          entry: { sql, outcome: historyKindFor(outcome), timestamp },
          outcome,
        });
        void deps.saveHistory.save(sql, outcome, timestamp).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          dispatch({ type: "setStatus", status: { text: `history: ${message}`, kind: "error" } });
        });
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
}
