export type HistoryOutcome =
  | "ok"
  | "affected"
  | "side-effect"
  | "plan"
  | "error";

export type HistoryEntry = {
  sql: string;
  outcome: HistoryOutcome;
  timestamp: number;
};
