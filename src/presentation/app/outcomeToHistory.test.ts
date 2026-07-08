import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { outcomeToHistoryKind } from "./outcomeToHistory.ts";

describe("outcomeToHistoryKind", () => {
  it("maps rows outcomes to 'ok'", () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [],
      rows: [[1]],
    };

    expect(outcomeToHistoryKind(outcome)).toBe("ok");
  });

  it("maps affected outcomes to 'affected'", () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 1,
      lastInsertRowid: 0,
    };

    expect(outcomeToHistoryKind(outcome)).toBe("affected");
  });

  it("maps side-effect outcomes to 'side-effect'", () => {
    const outcome: QueryOutcome = { kind: "side-effect" };

    expect(outcomeToHistoryKind(outcome)).toBe("side-effect");
  });

  it("maps plan outcomes to 'ok'", () => {
    const outcome: QueryOutcome = { kind: "plan", nodes: [] };

    expect(outcomeToHistoryKind(outcome)).toBe("ok");
  });

  it("maps error outcomes to 'error'", () => {
    const outcome: QueryOutcome = {
      kind: "error",
      code: "SQLITE_CONSTRAINT",
      message: "UNIQUE constraint failed: t.id",
    };

    expect(outcomeToHistoryKind(outcome)).toBe("error");
  });
});
