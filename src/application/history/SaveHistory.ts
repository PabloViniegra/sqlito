import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { HistoryRepository } from "../../infrastructure/filesystem/HistoryRepository.ts";

export class SaveHistory {
  private readonly repo: HistoryRepository;

  constructor(repo: HistoryRepository) {
    this.repo = repo;
  }

  async save(
    sql: string,
    outcome: QueryOutcome,
    timestamp: number,
  ): Promise<void> {
    const historyOutcome = outcomeKindToHistoryOutcome(outcome);
    if (historyOutcome === null) return;
    const entry: HistoryEntry = { sql, outcome: historyOutcome, timestamp };
    await this.repo.append(entry);
  }
}

function outcomeKindToHistoryOutcome(
  outcome: QueryOutcome,
): HistoryEntry["outcome"] | null {
  switch (outcome.kind) {
    case "rows":
      return "ok";
    case "affected":
      return "affected";
    case "side-effect":
      return "side-effect";
    case "error":
      return null;
  }
}
