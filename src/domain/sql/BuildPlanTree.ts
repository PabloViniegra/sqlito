import type { PlanNode } from "./PlanNode.ts";

export function BuildPlanTree(rows: readonly unknown[][]): PlanNode[] {
  if (rows.length === 0) return [];

  const byId = new Map<number, PlanNode>();
  for (const row of rows) {
    const id = Number(row[0]);
    const parent = Number(row[1]);
    const detail = String(row[3] ?? "");
    byId.set(id, { id, parent, detail, depth: 0, children: [] });
  }

  const roots: PlanNode[] = [];
  for (const node of byId.values()) {
    const parentNode =
      node.parent !== 0 && node.parent !== node.id
        ? byId.get(node.parent)
        : undefined;
    if (parentNode === undefined) {
      roots.push(node);
    } else {
      // SAFETY: PlanNode.children is declared readonly to discourage external mutation, but building the tree requires pushing into the freshly-created child arrays.
      (parentNode.children as PlanNode[]).push(node);
    }
  }

  assignDepths(roots, 0);
  return roots;
}

function assignDepths(nodes: readonly PlanNode[], depth: number): void {
  for (const node of nodes) {
    // SAFETY: PlanNode.depth is declared readonly; assigning during the post-order walk is the only way to compute depth from the root-down construction.
    (node as { depth: number }).depth = depth;
    assignDepths(node.children, depth + 1);
  }
}
