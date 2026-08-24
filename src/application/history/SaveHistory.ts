import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import { historyKindFor } from "../../domain/sql/historyKind.ts";
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
    if (outcome.kind === "error") return;
    const entry: HistoryEntry = {
      sql,
      outcome: historyKindFor(outcome),
      timestamp,
    };
    await this.repo.append(entry);
  }
}
