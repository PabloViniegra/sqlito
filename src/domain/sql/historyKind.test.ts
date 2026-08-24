import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "./QueryOutcome.ts";
import { historyKindFor } from "./historyKind.ts";

describe("historyKindFor", () => {
  it("maps rows to 'ok'", () => {
    expect(
      historyKindFor({
        kind: "rows",
        columns: [],
        rows: [[1]],
      } satisfies QueryOutcome),
    ).toBe("ok");
  });

  it("maps affected to 'affected'", () => {
    expect(
      historyKindFor({
        kind: "affected",
        changes: 1,
        lastInsertRowid: 0,
      } satisfies QueryOutcome),
    ).toBe("affected");
  });

  it("maps side-effect to 'side-effect'", () => {
    expect(historyKindFor({ kind: "side-effect" } satisfies QueryOutcome)).toBe(
      "side-effect",
    );
  });

  it("maps plan to 'plan' (distinguishes EXPLAIN from a real SELECT)", () => {
    expect(historyKindFor({ kind: "plan", nodes: [] } satisfies QueryOutcome)).toBe(
      "plan",
    );
  });

  it("maps error to 'error'", () => {
    expect(
      historyKindFor({
        kind: "error",
        message: "boom",
      } satisfies QueryOutcome),
    ).toBe("error");
  });
});
