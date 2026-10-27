import { homedir } from "node:os";
import { join } from "node:path";

function resolveXdgPath(
  env: NodeJS.ProcessEnv,
  envVar: "XDG_DATA_HOME" | "XDG_CONFIG_HOME",
  fallbackSegments: readonly string[],
  file: string,
): string {
  const xdg = env[envVar];
  const base =
    xdg !== undefined && xdg !== ""
      ? xdg
      : join(homedir(), ...fallbackSegments);
  return join(base, "sqlito", file);
}

export function resolveXdgHistoryPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveXdgPath(
    env,
    "XDG_DATA_HOME",
    [".local", "share"],
    "history.jsonl",
  );
}

export function resolveXdgFavoritesPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveXdgPath(
    env,
    "XDG_DATA_HOME",
    [".local", "share"],
    "favorites.json",
  );
}

export function resolveXdgConfigPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveXdgPath(env, "XDG_CONFIG_HOME", [".config"], "config.json");
}
