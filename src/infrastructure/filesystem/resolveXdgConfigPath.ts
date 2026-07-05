import { homedir } from "node:os";
import { join } from "node:path";

export function resolveXdgConfigPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const xdg = env.XDG_CONFIG_HOME;
  const base =
    xdg !== undefined && xdg !== "" ? xdg : join(homedir(), ".config");
  return join(base, "sqlito", "config.json");
}
