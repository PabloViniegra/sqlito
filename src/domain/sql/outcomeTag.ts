import type { QueryOutcome } from "./QueryOutcome.ts";

export type OutcomeTag = "READ" | "WRITE" | "DDL" | "ERROR" | "PLAN";

export function outcomeTag(outcome: QueryOutcome): OutcomeTag {
  switch (outcome.kind) {
    case "rows":
      return outcome.writes === true ? "WRITE" : "READ";
    case "affected":
      return "WRITE";
    case "side-effect":
      return "DDL";
    case "plan":
      return "PLAN";
    case "error":
      return "ERROR";
  }
}
