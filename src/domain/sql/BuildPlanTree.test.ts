import { describe, expect, it } from "vitest";
import { BuildPlanTree } from "./BuildPlanTree.ts";

describe("BuildPlanTree", () => {
  it("returns [] for empty input", () => {
    expect(BuildPlanTree([])).toEqual([]);
  });

  it("returns a single root node for a one-row input", () => {
    const nodes = BuildPlanTree([[0, 0, 0, "SCAN t"]]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]).toMatchObject({
      id: 0,
      parent: 0,
      detail: "SCAN t",
      depth: 0,
    });
    expect(nodes[0]!.children).toEqual([]);
  });

  it("renders multi-root input as siblings (each at depth 0)", () => {
    const nodes = BuildPlanTree([
      [1, 0, 0, "SCAN a"],
      [2, 0, 0, "SCAN b"],
    ]);

    expect(nodes).toHaveLength(2);
    expect(nodes[0]!.detail).toBe("SCAN a");
    expect(nodes[0]!.depth).toBe(0);
    expect(nodes[1]!.detail).toBe("SCAN b");
    expect(nodes[1]!.depth).toBe(0);
  });

  it("computes depth through three levels of nesting", () => {
    const nodes = BuildPlanTree([
      [1, 0, 0, "root"],
      [2, 1, 0, "middle"],
      [3, 2, 0, "leaf"],
    ]);

    expect(nodes).toHaveLength(1);
    const root = nodes[0]!;
    expect(root.depth).toBe(0);
    expect(root.children).toHaveLength(1);
    const middle = root.children[0]!;
    expect(middle.depth).toBe(1);
    expect(middle.children).toHaveLength(1);
    const leaf = middle.children[0]!;
    expect(leaf.depth).toBe(2);
    expect(leaf.children).toEqual([]);
  });

  it("treats a node with unknown parent as an orphan root at depth 0", () => {
    const nodes = BuildPlanTree([
      [1, 0, 0, "real root"],
      [2, 99, 0, "orphan"],
    ]);

    expect(nodes).toHaveLength(2);
    expect(nodes.map((n) => n.detail).sort()).toEqual(["orphan", "real root"]);
    for (const node of nodes) {
      expect(node.depth).toBe(0);
      expect(node.children).toEqual([]);
    }
  });

  it("last-write-wins on duplicate ids (documented behaviour)", () => {
    const nodes = BuildPlanTree([
      [1, 0, 0, "first"],
      [1, 0, 0, "second"],
    ]);

    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.detail).toBe("second");
  });
});
