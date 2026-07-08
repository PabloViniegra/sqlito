import { describe, expect, it } from "vitest";
import type { PlanNode } from "../../domain/sql/PlanNode.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { renderOutcomeChip } from "./outcomeChip.ts";

const leaf: PlanNode = {
  id: 1,
  parent: 0,
  detail: "x",
  depth: 0,
  children: [],
};

describe("renderOutcomeChip", () => {
  it("renders READ <rows.length> for a rows outcome", () => {
    const outcome: QueryOutcome = {
      kind: "rows",
      columns: [],
      rows: [[1], [2], [3]],
    };

    expect(renderOutcomeChip(outcome)).toEqual({ tag: "READ", detail: "3" });
  });

  it("renders READ 0 for a rows outcome with no rows", () => {
    expect(renderOutcomeChip({ kind: "rows", columns: [], rows: [] })).toEqual({
      tag: "READ",
      detail: "0",
    });
  });

  it("renders WRITE <changes> for an affected outcome", () => {
    expect(
      renderOutcomeChip({ kind: "affected", changes: 4, lastInsertRowid: 1 }),
    ).toEqual({ tag: "WRITE", detail: "4" });
  });

  it("renders WRITE 0 no-match when changes is zero", () => {
    expect(
      renderOutcomeChip({ kind: "affected", changes: 0, lastInsertRowid: 0 }),
    ).toEqual({ tag: "WRITE", detail: "0 no-match" });
  });

  it("renders DDL for a side-effect outcome", () => {
    expect(renderOutcomeChip({ kind: "side-effect" })).toEqual({
      tag: "DDL",
      detail: "",
    });
  });

  it("renders PLAN <nodes.length> for a plan outcome (top-level array length)", () => {
    const plan: QueryOutcome = { kind: "plan", nodes: [leaf, leaf, leaf] };

    expect(renderOutcomeChip(plan)).toEqual({ tag: "PLAN", detail: "3" });
  });

  it("renders ERROR <code> when code is present and message is long", () => {
    expect(
      renderOutcomeChip({
        kind: "error",
        code: "SQLITE_CONSTRAINT",
        message: "x".repeat(40),
      }),
    ).toEqual({ tag: "ERROR", detail: "SQLITE_CONSTRAINT" });
  });

  it("renders ERROR <code>: <message> when code is present and message is short (<30 chars)", () => {
    expect(
      renderOutcomeChip({
        kind: "error",
        code: "SQLITE_CONSTRAINT",
        message: "unique violation",
      }),
    ).toEqual({
      tag: "ERROR",
      detail: "SQLITE_CONSTRAINT: unique violation",
    });
  });

  it("renders bare ERROR when there is no code", () => {
    expect(renderOutcomeChip({ kind: "error", message: "boom" })).toEqual({
      tag: "ERROR",
      detail: "",
    });
  });
});
