import type { HistoryEntry } from "../history/HistoryEntry.ts";
import type { QueryOutcome } from "./QueryOutcome.ts";

export function historyKindFor(
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
      return "plan";
    case "error":
      return "error";
  }
}
