import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveXdgConfigPath } from "./resolveXdgConfigPath.ts";
import { resolveXdgFavoritesPath } from "./resolveXdgFavoritesPath.ts";
import { resolveXdgHistoryPath } from "./resolveXdgHistoryPath.ts";

const CASES = [
  {
    name: "resolveXdgHistoryPath",
    resolve: resolveXdgHistoryPath,
    envVar: "XDG_DATA_HOME",
    fallback: [".local", "share"],
    file: "history.jsonl",
  },
  {
    name: "resolveXdgFavoritesPath",
    resolve: resolveXdgFavoritesPath,
    envVar: "XDG_DATA_HOME",
    fallback: [".local", "share"],
    file: "favorites.json",
  },
  {
    name: "resolveXdgConfigPath",
    resolve: resolveXdgConfigPath,
    envVar: "XDG_CONFIG_HOME",
    fallback: [".config"],
    file: "config.json",
  },
] as const;

describe.each(CASES)("$name", ({ resolve, envVar, fallback, file }) => {
  it("uses the XDG env var when set", () => {
    expect(resolve({ [envVar]: "/custom/base" })).toBe(
      `/custom/base/sqlito/${file}`,
    );
  });

  it("falls back to the default base when the env var is unset", () => {
    expect(resolve({})).toBe(join(homedir(), ...fallback, "sqlito", file));
  });

  it("falls back when the env var is the empty string", () => {
    expect(resolve({ [envVar]: "" })).toBe(
      join(homedir(), ...fallback, "sqlito", file),
    );
  });
});
