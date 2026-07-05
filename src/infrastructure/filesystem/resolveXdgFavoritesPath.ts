import { homedir } from "node:os";
import { join } from "node:path";

export function resolveXdgFavoritesPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const xdg = env.XDG_DATA_HOME;
  const base =
    xdg !== undefined && xdg !== "" ? xdg : join(homedir(), ".local", "share");
  return join(base, "sqlito", "favorites.json");
}
