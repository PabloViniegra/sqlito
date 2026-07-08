import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export type OutcomeChipText = {
  readonly tag: string;
  readonly detail: string;
};

export function renderOutcomeChip(outcome: QueryOutcome): OutcomeChipText {
  switch (outcome.kind) {
    case "rows":
      return { tag: "READ", detail: String(outcome.rows.length) };
    case "affected":
      return {
        tag: "WRITE",
        detail: outcome.changes === 0 ? "0 no-match" : String(outcome.changes),
      };
    case "side-effect":
      return { tag: "DDL", detail: "" };
    case "plan":
      return { tag: "PLAN", detail: String(outcome.nodes.length) };
    case "error": {
      const { code, message } = outcome;
      if (code === undefined) return { tag: "ERROR", detail: "" };
      if (message.length < 30) {
        return { tag: "ERROR", detail: `${code}: ${message}` };
      }
      return { tag: "ERROR", detail: code };
    }
  }
}
