import { useMemo } from "react";
import { historyKindFor } from "../../domain/sql/historyKind.ts";
import type { AppDispatch, DotCommandDeps } from "./dotCommand.ts";
import type { AppState } from "./appReducer.ts";
import type { MutableRefObject } from "react";
import type { AppDeps } from "./useAppDeps.ts";

export function useDotCommandDeps({
  deps,
  state,
  dispatch,
  lastSuccessfulSqlRef,
}: {
  deps: AppDeps;
  state: AppState;
  dispatch: AppDispatch;
  lastSuccessfulSqlRef: MutableRefObject<string>;
}): DotCommandDeps {
  return useMemo(
    () => ({
      dispatch,
      exportCsv: deps.exportCsv,
      copyCsv: deps.copyCsv,
      schema: deps.schemaPrettyPrint,
      lastOutcome: state.lastOutcome,
      onQuit: deps.quit,
      sessionVars: deps.sessionVars,
      variables: state.variables,
      runExplain: deps.runExplain,
      lastSql: lastSuccessfulSqlRef.current,
      showResult: (resultSql, outcome) =>
        dispatch({
          type: "recordQuery",
          entry: {
            sql: resultSql,
            outcome: historyKindFor(outcome),
            timestamp: Date.now(),
          },
          outcome,
        }),
      saveFavorite: deps.saveFavorite,
      runFavorite: deps.runFavorite,
      forgetFavorite: deps.forgetFavorite,
      favorites: state.favorites,
      switchTheme: deps.switchTheme,
    }),
    [
      deps.exportCsv,
      deps.copyCsv,
      deps.schemaPrettyPrint,
      deps.quit,
      deps.sessionVars,
      deps.runExplain,
      deps.saveFavorite,
      deps.runFavorite,
      deps.forgetFavorite,
      deps.switchTheme,
      dispatch,
      state.lastOutcome,
      state.variables,
      state.favorites,
      lastSuccessfulSqlRef,
    ],
  );
}
