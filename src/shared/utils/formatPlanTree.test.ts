import { describe, expect, it } from "vitest";
import type { PlanNode } from "../../domain/sql/PlanNode.ts";
import { formatPlanTree } from "./formatPlanTree.ts";

describe("formatPlanTree", () => {
  it("returns [] for empty input", () => {
    expect(formatPlanTree([])).toEqual([]);
  });

  it("renders a single root node with no indent", () => {
    const tree: PlanNode[] = [
      { id: 1, parent: 0, detail: "SCAN t", depth: 0, children: [] },
    ];

    expect(formatPlanTree(tree)).toEqual(["SCAN t"]);
  });

  it("renders multi-root input as siblings", () => {
    const tree: PlanNode[] = [
      { id: 1, parent: 0, detail: "SCAN a", depth: 0, children: [] },
      { id: 2, parent: 0, detail: "SCAN b", depth: 0, children: [] },
    ];

    expect(formatPlanTree(tree)).toEqual(["SCAN a", "SCAN b"]);
  });

  it("indents nested children by two spaces per depth level", () => {
    const tree: PlanNode[] = [
      {
        id: 1,
        parent: 0,
        detail: "root",
        depth: 0,
        children: [
          {
            id: 2,
            parent: 1,
            detail: "middle",
            depth: 1,
            children: [
              { id: 3, parent: 2, detail: "leaf", depth: 2, children: [] },
            ],
          },
        ],
      },
    ];

    expect(formatPlanTree(tree)).toEqual(["root", "  middle", "    leaf"]);
  });

  it("truncates lines that exceed terminal width", () => {
    const tree: PlanNode[] = [
      {
        id: 1,
        parent: 0,
        detail: "SCAN very_long_table_name USING INDEX very_long_index_name",
        depth: 0,
        children: [],
      },
    ];

    const lines = formatPlanTree(tree, 20);

    expect(lines).toHaveLength(1);
    expect(lines[0]!.length).toBeLessThanOrEqual(20);
  });
});
