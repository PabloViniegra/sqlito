import { describe, expect, it } from "vitest";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { fakeHistoryRepository } from "../../infrastructure/filesystem/HistoryRepository.ts";
import { SaveHistory } from "./SaveHistory.ts";

describe("SaveHistory", () => {
  const errorOutcome: QueryOutcome = {
    kind: "error",
    message: "boom",
  };

  it("persists rows outcomes as 'ok'", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new SaveHistory(repo);

    await useCase.save(
      "SELECT 1",
      { kind: "rows", columns: [], rows: [[1]] },
      1700000000000,
    );

    expect(repo.appended).toEqual([
      { sql: "SELECT 1", outcome: "ok", timestamp: 1700000000000 },
    ]);
  });

  it("persists affected outcomes", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new SaveHistory(repo);

    await useCase.save(
      "UPDATE t SET x = 1",
      { kind: "affected", changes: 1, lastInsertRowid: 0 },
      1,
    );

    expect(repo.appended).toEqual([
      { sql: "UPDATE t SET x = 1", outcome: "affected", timestamp: 1 },
    ]);
  });

  it("persists side-effect outcomes", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new SaveHistory(repo);

    await useCase.save("VACUUM", { kind: "side-effect" }, 1);

    expect(repo.appended).toEqual([
      { sql: "VACUUM", outcome: "side-effect", timestamp: 1 },
    ]);
  });

  it("never persists error outcomes", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new SaveHistory(repo);

    await useCase.save("SELECT bad", errorOutcome, 1);

    expect(repo.appended).toEqual([]);
  });

  it("collapses consecutive identical SQLs", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new SaveHistory(repo);

    await useCase.save(
      "SELECT 1",
      { kind: "rows", columns: [], rows: [[1]] },
      1,
    );
    await useCase.save(
      "SELECT 1",
      { kind: "rows", columns: [], rows: [[1]] },
      2,
    );

    expect(repo.appended).toEqual([
      { sql: "SELECT 1", outcome: "ok", timestamp: 1 },
    ]);
  });

  it("keeps non-consecutive duplicates", async () => {
    const repo = fakeHistoryRepository();
    const useCase = new SaveHistory(repo);

    await useCase.save("A", { kind: "rows", columns: [], rows: [[1]] }, 1);
    await useCase.save("B", { kind: "rows", columns: [], rows: [[2]] }, 2);
    await useCase.save("A", { kind: "rows", columns: [], rows: [[1]] }, 3);

    expect(repo.appended).toHaveLength(3);
  });
});
