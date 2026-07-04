import { describe, expect, it } from "vitest";
import { fakeHistoryRepository } from "../../infrastructure/filesystem/HistoryRepository.ts";
import { LoadHistory } from "./LoadHistory.ts";

describe("LoadHistory", () => {
  it("returns recent entries from the repository", async () => {
    const repo = fakeHistoryRepository([
      { sql: "a", outcome: "ok", timestamp: 1 },
      { sql: "b", outcome: "ok", timestamp: 2 },
    ]);
    const useCase = new LoadHistory(repo);

    const entries = await useCase.load();

    expect(entries.map((e) => e.sql)).toEqual(["b", "a"]);
  });

  it("returns the empty array on a fresh repository", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new LoadHistory(repo);

    expect(await useCase.load()).toEqual([]);
  });

  it("respects a custom limit", async () => {
    const repo = fakeHistoryRepository([
      { sql: "a", outcome: "ok", timestamp: 1 },
      { sql: "b", outcome: "ok", timestamp: 2 },
      { sql: "c", outcome: "ok", timestamp: 3 },
    ]);
    const useCase = new LoadHistory(repo);

    const entries = await useCase.load(2);

    expect(entries.map((e) => e.sql)).toEqual(["c", "b"]);
  });
});
