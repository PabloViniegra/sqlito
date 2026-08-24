import { homedir } from "node:os";
import { join } from "node:path";

export function resolveXdgPath(
  env: NodeJS.ProcessEnv,
  envVar: "XDG_DATA_HOME" | "XDG_CONFIG_HOME",
  fallbackSegments: readonly string[],
  ...segments: readonly string[]
): string {
  const xdg = env[envVar];
  const base =
    xdg !== undefined && xdg !== "" ? xdg : join(homedir(), ...fallbackSegments);
  return join(base, ...segments);
}
