import type { ReadlineState } from "./readline.ts";

export type RecallErrorDirection = "up" | "down";

export type RecallErrorParams = {
  prompt: ReadlineState;
  failedSql: string;
  direction: RecallErrorDirection;
};

export function recallError(params: RecallErrorParams): ReadlineState | null {
  const { prompt, failedSql, direction } = params;
  if (direction !== "up") return null;
  if (prompt.text !== "" || prompt.cursor !== 0) return null;
  if (failedSql === "") return null;
  return { text: failedSql, cursor: failedSql.length };
}
