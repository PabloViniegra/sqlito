import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import { HISTORY_CAP, XdgHistoryRepository } from "./XdgHistoryRepository.ts";

describe("XdgHistoryRepository", () => {
  let dir: string;
  let repo: XdgHistoryRepository;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sqlito-history-"));
    repo = new XdgHistoryRepository(join(dir, "history.jsonl"));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const countLines = async () => {
    const raw = await readFile(join(dir, "history.jsonl"), "utf8");
    return raw.split("\n").filter((l) => l.length > 0).length;
  };

  describe("append", () => {
    it("writes a JSON-encoded line per entry", async () => {
      await repo.append({ sql: "SELECT 1", outcome: "ok", timestamp: 1 });
      expect(await countLines()).toBe(1);
    });

    it("persists two distinct entries as two lines", async () => {
      await repo.append({ sql: "SELECT 1", outcome: "ok", timestamp: 1 });
      await repo.append({ sql: "SELECT 2", outcome: "ok", timestamp: 2 });
      expect(await countLines()).toBe(2);
    });

    it("collapses two consecutive identical SQLs into one line", async () => {
      await repo.append({ sql: "SELECT 1", outcome: "ok", timestamp: 1 });
      await repo.append({ sql: "SELECT 1", outcome: "ok", timestamp: 2 });
      expect(await countLines()).toBe(1);
    });

    it("keeps non-consecutive duplicates", async () => {
      await repo.append({ sql: "A", outcome: "ok", timestamp: 1 });
      await repo.append({ sql: "B", outcome: "ok", timestamp: 2 });
      await repo.append({ sql: "A", outcome: "ok", timestamp: 3 });
      expect(await countLines()).toBe(3);
    });

    it("creates the parent directory if it does not exist", async () => {
      const nested = new XdgHistoryRepository(
        join(dir, "deep", "nested", "history.jsonl"),
      );
      await nested.append({ sql: "SELECT 1", outcome: "ok", timestamp: 1 });
      const raw = await readFile(
        join(dir, "deep", "nested", "history.jsonl"),
        "utf8",
      );
      expect(raw.length).toBeGreaterThan(0);
    });
  });

  describe("FIFO cap", () => {
    it("keeps at most HISTORY_CAP entries", async () => {
      for (let i = 0; i < HISTORY_CAP + 1; i++) {
        await repo.append({ sql: `q${i}`, outcome: "ok", timestamp: i });
      }
      const all = await repo.recent(HISTORY_CAP + 10);
      expect(all).toHaveLength(HISTORY_CAP);
    });

    it("drops the oldest entries once the cap is exceeded", async () => {
      for (let i = 0; i < HISTORY_CAP + 3; i++) {
        await repo.append({ sql: `q${i}`, outcome: "ok", timestamp: i });
      }
      const all = await repo.recent(HISTORY_CAP + 10);
      const newest = all[0];
      const oldest = all[all.length - 1];
      expect(newest?.sql).toBe(`q${HISTORY_CAP + 2}`);
      expect(oldest?.sql).toBe(`q3`);
    });

    it("rewrites the file when the cap is exceeded", async () => {
      for (let i = 0; i < HISTORY_CAP + 1; i++) {
        await repo.append({ sql: `q${i}`, outcome: "ok", timestamp: i });
      }
      expect(await countLines()).toBe(HISTORY_CAP);
    });
  });

  describe("recent", () => {
    it("returns newest entries first", async () => {
      await repo.append({ sql: "a", outcome: "ok", timestamp: 1 });
      await repo.append({ sql: "b", outcome: "ok", timestamp: 2 });
      await repo.append({ sql: "c", outcome: "ok", timestamp: 3 });

      const entries = await repo.recent(2);
      expect(entries.map((e) => e.sql)).toEqual(["c", "b"]);
    });

    it("returns an empty array when the file does not exist", async () => {
      const emptyDir = await mkdtemp(join(tmpdir(), "sqlito-history-"));
      try {
        const r = new XdgHistoryRepository(join(emptyDir, "absent.jsonl"));
        expect(await r.recent(50)).toEqual([]);
      } finally {
        await rm(emptyDir, { recursive: true, force: true });
      }
    });

    it("loads entries from disk for a fresh instance", async () => {
      await repo.append({ sql: "a", outcome: "ok", timestamp: 1 });
      await repo.append({ sql: "b", outcome: "ok", timestamp: 2 });

      const fresh = new XdgHistoryRepository(join(dir, "history.jsonl"));
      const entries = await fresh.recent(10);
      expect(entries.map((e) => e.sql)).toEqual(["b", "a"]);
    });
  });

  describe("search", () => {
    const seed = async (
      r: XdgHistoryRepository,
      entries: readonly HistoryEntry[],
    ) => {
      for (const e of entries) await r.append(e);
    };

    it("returns entries whose SQL contains the substring, newest-first", async () => {
      await seed(repo, [
        { sql: "SELECT 1", outcome: "ok", timestamp: 1 },
        { sql: "INSERT INTO t VALUES (1)", outcome: "affected", timestamp: 2 },
        { sql: "SELECT name FROM t", outcome: "ok", timestamp: 3 },
        { sql: "VACUUM", outcome: "side-effect", timestamp: 4 },
      ]);
      const matches = await repo.search("SELECT", 10);
      expect(matches.map((e) => e.sql)).toEqual([
        "SELECT name FROM t",
        "SELECT 1",
      ]);
    });

    it("matches case-insensitively", async () => {
      await seed(repo, [
        { sql: "SELECT 1", outcome: "ok", timestamp: 1 },
        { sql: "select 2", outcome: "ok", timestamp: 2 },
      ]);
      const matches = await repo.search("select", 10);
      expect(matches.map((e) => e.sql)).toEqual(["select 2", "SELECT 1"]);
    });

    it("caps the result to the given limit", async () => {
      for (let i = 0; i < 5; i++) {
        await repo.append({ sql: `SELECT ${i}`, outcome: "ok", timestamp: i });
      }
      const matches = await repo.search("SELECT", 2);
      expect(matches).toHaveLength(2);
      expect(matches.map((e) => e.sql)).toEqual(["SELECT 4", "SELECT 3"]);
    });

    it("returns the empty array when nothing matches", async () => {
      await repo.append({ sql: "SELECT 1", outcome: "ok", timestamp: 1 });
      expect(await repo.search("VACUUM", 10)).toEqual([]);
    });

    it("returns all entries when the substring is empty", async () => {
      await repo.append({ sql: "a", outcome: "ok", timestamp: 1 });
      await repo.append({ sql: "b", outcome: "ok", timestamp: 2 });
      const matches = await repo.search("", 10);
      expect(matches.map((e) => e.sql)).toEqual(["b", "a"]);
    });
  });
});
