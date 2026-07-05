import type { Column } from "./Column.ts";
import type { PlanNode } from "./PlanNode.ts";

export type QueryOutcome =
  | { kind: "rows"; columns: readonly Column[]; rows: readonly unknown[][] }
  | { kind: "affected"; changes: number; lastInsertRowid: number | bigint }
  | { kind: "side-effect" }
  | { kind: "plan"; nodes: readonly PlanNode[] }
  | { kind: "error"; code?: string; message: string };
