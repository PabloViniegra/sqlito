export type HistoryOutcome = "ok" | "affected" | "side-effect" | "error";

export type HistoryEntry = {
  sql: string;
  outcome: HistoryOutcome;
  timestamp: number;
};
