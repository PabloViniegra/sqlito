import { resolveXdgPath } from "./resolveXdgPath.ts";

export function resolveXdgConfigPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveXdgPath(env, "XDG_CONFIG_HOME", [".config"], "sqlito", "config.json");
}
