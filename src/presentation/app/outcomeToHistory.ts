import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export function outcomeToHistoryKind(
  outcome: QueryOutcome,
): HistoryEntry["outcome"] {
  switch (outcome.kind) {
    case "rows":
      return "ok";
    case "affected":
      return "affected";
    case "side-effect":
      return "side-effect";
    case "plan":
      return "ok";
    case "error":
      return "ok";
  }
}
