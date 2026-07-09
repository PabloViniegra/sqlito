import { outcomeTag } from "../../domain/sql/outcomeTag.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export type OutcomeChipText = {
  readonly tag: string;
  readonly detail: string;
};

export function renderOutcomeChip(outcome: QueryOutcome): OutcomeChipText {
  const tag = outcomeTag(outcome);
  switch (outcome.kind) {
    case "rows":
      return { tag, detail: String(outcome.rows.length) };
    case "affected":
      return {
        tag,
        detail:
          outcome.changes === 0 ? "0 rows matched" : `${outcome.changes} rows`,
      };
    case "side-effect":
      return { tag, detail: "" };
    case "plan":
      return { tag, detail: String(outcome.nodes.length) };
    case "error": {
      const { code, message } = outcome;
      if (code === undefined) return { tag, detail: "" };
      if (message.length < 30) {
        return { tag, detail: `${code}: ${message}` };
      }
      return { tag, detail: code };
    }
  }
}
