export type PlanNode = {
  id: number;
  parent: number;
  detail: string;
  depth: number;
  children: readonly PlanNode[];
};
