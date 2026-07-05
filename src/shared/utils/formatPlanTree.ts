import truncate from "cli-truncate";
import type { PlanNode } from "../../domain/sql/PlanNode.ts";

const INDENT = "  ";

export function formatPlanTree(
  nodes: readonly PlanNode[],
  terminalWidth: number = 80,
): string[] {
  const lines: string[] = [];
  walk(nodes, 0, terminalWidth, lines);
  return lines;
}

function walk(
  nodes: readonly PlanNode[],
  depth: number,
  terminalWidth: number,
  lines: string[],
): void {
  for (const node of nodes) {
    const indent = INDENT.repeat(depth);
    const available = Math.max(0, terminalWidth - indent.length);
    lines.push(truncate(`${indent}${node.detail}`, available));
    walk(node.children, depth + 1, terminalWidth, lines);
  }
}
