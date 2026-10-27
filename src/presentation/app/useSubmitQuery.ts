import { useCallback, type MutableRefObject } from "react";
import { historyKindFor } from "../../domain/sql/historyKind.ts";
import type { AppDispatch } from "./dotCommand.ts";
import type { AppDeps } from "./useAppDeps.ts";

export function useSubmitQuery({
  deps,
  dispatch,
  lastSuccessfulSqlRef,
  lastFailedSqlRef,
}: {
  deps: AppDeps;
  dispatch: AppDispatch;
  lastSuccessfulSqlRef: MutableRefObject<string>;
  lastFailedSqlRef: MutableRefObject<string>;
}): (sql: string) => Promise<void> {
  return useCallback(
    async (sql: string) => {
      dispatch({ type: "queryStarted" });
      const outcome = await deps.executeQuery.execute(sql);
      dispatch({ type: "submit", outcome });
      if (outcome.kind === "side-effect") void deps.schema.refresh();
      if (outcome.kind === "error") {
        lastFailedSqlRef.current = sql;
        dispatch({ type: "recordError", sql, outcome });
        return;
      }
      const timestamp = Date.now();
      lastSuccessfulSqlRef.current = sql;
      dispatch({
        type: "recordQuery",
        entry: { sql, outcome: historyKindFor(outcome), timestamp },
        outcome,
      });
      void deps.saveHistory.save(sql, outcome, timestamp).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        dispatch({
          type: "setStatus",
          status: { text: `history: ${message}`, kind: "error" },
        });
      });
      // a successful query invalidates the prior failure's recall slot — only the most recent error is recallable
      lastFailedSqlRef.current = "";
    },
    [deps, dispatch, lastSuccessfulSqlRef, lastFailedSqlRef],
  );
}
