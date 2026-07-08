import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "./QueryOutcome.ts";
import { outcomeTag } from "./outcomeTag.ts";

describe("outcomeTag", () => {
  it("maps rows outcomes to READ", () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [],
      rows: [],
    };

    expect(outcomeTag(outcome)).toBe("READ");
  });

  it("maps affected outcomes to WRITE", () => {
    const outcome: QueryOutcome = {
      kind: "affected",
      changes: 1,
      lastInsertRowid: 0,
    };

    expect(outcomeTag(outcome)).toBe("WRITE");
  });

  it("maps side-effect outcomes to DDL", () => {
    const outcome: QueryOutcome = { kind: "side-effect" };

    expect(outcomeTag(outcome)).toBe("DDL");
  });

  it("maps plan outcomes to PLAN", () => {
    const outcome: QueryOutcome = { kind: "plan", nodes: [] };

    expect(outcomeTag(outcome)).toBe("PLAN");
  });

  it("maps error outcomes to ERROR", () => {
    const outcome: QueryOutcome = { kind: "error", message: "boom" };

    expect(outcomeTag(outcome)).toBe("ERROR");
  });
});
