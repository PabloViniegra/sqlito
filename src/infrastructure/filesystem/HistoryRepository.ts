import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";

export type HistoryRepository = {
  append: (entry: HistoryEntry) => Promise<void>;
  recent: (limit: number) => Promise<readonly HistoryEntry[]>;
  search: (
    substring: string,
    limit: number,
  ) => Promise<readonly HistoryEntry[]>;
};

export function fakeHistoryRepository(
  initial: readonly HistoryEntry[] = [],
): HistoryRepository & { appended: HistoryEntry[] } {
  const appended: HistoryEntry[] = [];
  let stored: readonly HistoryEntry[] = initial;
  return {
    appended,
    async append(entry: HistoryEntry): Promise<void> {
      const last = stored[stored.length - 1];
      if (last !== undefined && last.sql === entry.sql) return;
      stored = [...stored, entry];
      appended.push(entry);
    },
    async recent(limit: number): Promise<readonly HistoryEntry[]> {
      const start = Math.max(0, stored.length - limit);
      return stored.slice(start).slice().reverse();
    },
    async search(
      substring: string,
      limit: number,
    ): Promise<readonly HistoryEntry[]> {
      const haystack = substring.toLowerCase();
      const matches = stored.filter((e) =>
        e.sql.toLowerCase().includes(haystack),
      );
      const start = Math.max(0, matches.length - limit);
      return matches.slice(start).slice().reverse();
    },
  };
}
