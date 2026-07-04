export type HistoryOutcome = "ok" | "affected" | "side-effect";

export type HistoryEntry = {
  sql: string;
  outcome: HistoryOutcome;
  timestamp: number;
};
