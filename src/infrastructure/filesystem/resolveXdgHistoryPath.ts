import { resolveXdgPath } from "./resolveXdgPath.ts";

export function resolveXdgHistoryPath(
  env: NodeJS.ProcessEnv = process.env,
): string {
  return resolveXdgPath(
    env,
    "XDG_DATA_HOME",
    [".local", "share"],
    "sqlito",
    "history.jsonl",
  );
}
