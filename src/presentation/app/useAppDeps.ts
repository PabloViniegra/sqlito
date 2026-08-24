import { useApp } from "ink";
import { useCallback, useEffect, useMemo } from "react";
import { GetAutocompleteSuggestions } from "../../application/autocomplete/GetAutocompleteSuggestions.ts";
import { CopyCsv } from "../../application/commands/CopyCsv.ts";
import { ExportCsv } from "../../application/commands/ExportCsv.ts";
import { ForgetFavorite } from "../../application/favorites/ForgetFavorite.ts";
import { ListFavorites } from "../../application/favorites/ListFavorites.ts";
import { RunFavorite } from "../../application/favorites/RunFavorite.ts";
import { SaveFavorite } from "../../application/favorites/SaveFavorite.ts";
import { LoadHistory } from "../../application/history/LoadHistory.ts";
import { SaveHistory } from "../../application/history/SaveHistory.ts";
import { ExecuteQuery } from "../../application/queries/ExecuteQuery.ts";
import { RunExplain } from "../../application/queries/RunExplain.ts";
import { SchemaPrettyPrint } from "../../application/queries/SchemaPrettyPrint.ts";
import { LoadTheme } from "../../application/theme/LoadTheme.ts";
import { SwitchTheme } from "../../application/theme/SwitchTheme.ts";
import { SessionVariables } from "../../application/variables/SessionVariables.ts";
import type { Database } from "../../domain/database/Database.ts";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import { XdgFavoritesRepository } from "../../infrastructure/filesystem/XdgFavoritesRepository.ts";
import { resolveXdgFavoritesPath } from "../../infrastructure/filesystem/resolveXdgFavoritesPath.ts";
import { XdgHistoryRepository } from "../../infrastructure/filesystem/XdgHistoryRepository.ts";
import { resolveXdgHistoryPath } from "../../infrastructure/filesystem/resolveXdgHistoryPath.ts";
import { XdgThemeRepository } from "../../infrastructure/filesystem/XdgThemeRepository.ts";
import { resolveXdgConfigPath } from "../../infrastructure/filesystem/resolveXdgConfigPath.ts";
import type { AppDispatch } from "./dotCommand.ts";

export type AppDeps = {
  db: Database;
  schema: SchemaRepository;
  sessionVars: SessionVariables;
  executeQuery: ExecuteQuery;
  runExplain: RunExplain;
  exportCsv: ExportCsv;
  copyCsv: CopyCsv;
  schemaPrettyPrint: SchemaPrettyPrint;
  loadHistory: LoadHistory;
  saveHistory: SaveHistory;
  listFavorites: ListFavorites;
  saveFavorite: SaveFavorite;
  runFavorite: RunFavorite;
  forgetFavorite: ForgetFavorite;
  loadTheme: LoadTheme;
  switchTheme: SwitchTheme;
  autocomplete: GetAutocompleteSuggestions;
  quit: () => void;
};

export function useAppDeps({
  db,
  schema,
  dispatch,
}: {
  db: Database;
  schema: SchemaRepository;
  dispatch: AppDispatch;
}): AppDeps {
  const { exit } = useApp();

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
  const copyCsv = useMemo(() => new CopyCsv(), []);
  const schemaPrettyPrint = useMemo(
    () => new SchemaPrettyPrint(db),
    [db],
  );
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
  const switchTheme = useMemo(
    () => new SwitchTheme(themeRepo),
    [themeRepo],
  );

  const quit = useCallback(() => {
    db.close();
    dispatch({ type: "exit" });
    exit();
  }, [db, dispatch, exit]);

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
  }, [dispatch, loadHistory]);

  useEffect(() => {
    let cancelled = false;
    void listFavorites.list().then((favorites) => {
      if (!cancelled) dispatch({ type: "loadFavorites", favorites });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, listFavorites]);

  useEffect(() => {
    let cancelled = false;
    void loadTheme.load().then((theme) => {
      if (!cancelled) dispatch({ type: "setTheme", theme });
    });
    return () => {
      cancelled = true;
    };
  }, [dispatch, loadTheme]);

  return {
    db,
    schema,
    sessionVars,
    executeQuery,
    runExplain,
    exportCsv,
    copyCsv,
    schemaPrettyPrint,
    loadHistory,
    saveHistory,
    listFavorites,
    saveFavorite,
    runFavorite,
    forgetFavorite,
    loadTheme,
    switchTheme,
    autocomplete,
    quit,
  };
}
