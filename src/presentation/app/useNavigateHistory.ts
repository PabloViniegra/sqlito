import { useCallback, useState, type MutableRefObject } from "react";
import {
  DEFAULT_PROMPT_PREFIX,
  promptEffectiveWidth,
} from "../components/derivePromptLayout.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";
import type { AppDispatch } from "./dotCommand.ts";
import type { AppState } from "./appReducer.ts";
import { recallHistory } from "./recallHistory.ts";
import type { ReadlineState } from "./readline.ts";

export function useNavigateHistory({
  state,
  dispatch,
  stashedPromptRef,
}: {
  state: AppState;
  dispatch: AppDispatch;
  stashedPromptRef: MutableRefObject<ReadlineState | null>;
}): {
  navigateHistory: (direction: "up" | "down") => void;
  historyCursor: number;
  setHistoryCursor: (n: number) => void;
} {
  const { columns } = useViewportSize();
  const [historyCursor, setHistoryCursor] = useState(0);

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
      stashedPromptRef,
      dispatch,
    ],
  );

  return { navigateHistory, historyCursor, setHistoryCursor };
}
