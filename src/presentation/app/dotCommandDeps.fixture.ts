import { vi } from "vitest";
import { SessionVariables } from "../../application/variables/SessionVariables.ts";
import { stub } from "../../shared/utils/test-helpers.ts";
import type { DotCommandDeps } from "./dotCommand.ts";

export function makeDotCommandDeps(
  overrides: Partial<DotCommandDeps> = {},
): DotCommandDeps {
  return {
    dispatch: () => {},
    exportCsv: stub<DotCommandDeps["exportCsv"]>({ run: vi.fn() }),
    copyCsv: stub<DotCommandDeps["copyCsv"]>({ run: vi.fn() }),
    schema: stub<DotCommandDeps["schema"]>({
      tables: async () => "posts\nusers",
      indexes: async () => "idx on users",
      schema: async (name?: string) =>
        name === "ghost"
          ? { ok: false, error: "unknown table: ghost" }
          : { ok: true, text: "CREATE TABLE users (...);" },
    }),
    lastOutcome: null,
    onQuit: vi.fn(),
    sessionVars: new SessionVariables(),
    variables: [],
    runExplain: stub<DotCommandDeps["runExplain"]>({ explainLast: vi.fn() }),
    lastSql: "",
    showResult: vi.fn(),
    saveFavorite: stub<DotCommandDeps["saveFavorite"]>({ save: vi.fn() }),
    runFavorite: stub<DotCommandDeps["runFavorite"]>({ get: vi.fn() }),
    forgetFavorite: stub<DotCommandDeps["forgetFavorite"]>({
      forget: vi.fn(),
    }),
    favorites: [],
    switchTheme: stub<DotCommandDeps["switchTheme"]>({ switch: vi.fn() }),
    ...overrides,
  };
}
