import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import type { HistoryRepository } from "../../infrastructure/filesystem/HistoryRepository.ts";

export class LoadHistory {
  private readonly repo: HistoryRepository;

  constructor(repo: HistoryRepository) {
    this.repo = repo;
  }

  async load(limit = 1000): Promise<readonly HistoryEntry[]> {
    return this.repo.recent(limit);
  }
}
