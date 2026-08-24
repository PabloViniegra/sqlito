import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { HistoryEntry } from "../../domain/history/HistoryEntry.ts";
import { newestFirst } from "../../domain/history/historyView.ts";
import { atomicWrite, isEnoent } from "./atomicWrite.ts";

export const HISTORY_CAP = 1000;

export class XdgHistoryRepository {
  private readonly path: string;
  private entries: HistoryEntry[] = [];
  private loaded = false;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(path: string) {
    this.path = path;
  }

  async append(entry: HistoryEntry): Promise<void> {
    return this.serialise(async () => {
      await this.load();
      const last = this.entries[this.entries.length - 1];
      if (last !== undefined && last.sql === entry.sql) return;
      this.entries.push(entry);
      if (this.entries.length > HISTORY_CAP) {
        this.entries = this.entries.slice(-HISTORY_CAP);
        await atomicWrite(this.path, serialiseJsonl(this.entries));
        return;
      }
      await mkdir(dirname(this.path), { recursive: true });
      await writeFile(this.path, `${JSON.stringify(entry)}\n`, { flag: "a" });
    });
  }

  async recent(limit: number): Promise<readonly HistoryEntry[]> {
    return this.serialise(async () => {
      await this.load();
      return newestFirst(this.entries, limit);
    });
  }

  async search(
    substring: string,
    limit: number,
  ): Promise<readonly HistoryEntry[]> {
    return this.serialise(async () => {
      await this.load();
      const haystack = substring.toLowerCase();
      const matches = this.entries.filter((e) =>
        e.sql.toLowerCase().includes(haystack),
      );
      return newestFirst(matches, limit);
    });
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    let raw: string;
    try {
      raw = await readFile(this.path, "utf8");
    } catch (err) {
      if (isEnoent(err)) return;
      throw err;
    }
    this.entries = parseJsonl(raw);
    if (this.entries.length > HISTORY_CAP) {
      this.entries = this.entries.slice(-HISTORY_CAP);
    }
  }

  // Single-flight queue: every operation chains onto the previous one so
  // the in-memory `entries` array and the on-disk file stay in lockstep
  // under concurrent appends.
  private async serialise<T>(op: () => Promise<T>): Promise<T> {
    const previous = this.pending;
    let resolveNext: () => void = () => {};
    this.pending = new Promise<void>((resolve) => {
      resolveNext = resolve;
    });
    try {
      await previous;
      return await op();
    } finally {
      resolveNext();
    }
  }
}

function serialiseJsonl(entries: readonly HistoryEntry[]): string {
  return entries.map((e) => JSON.stringify(e)).join("\n") + "\n";
}

function parseJsonl(raw: string): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    try {
      out.push(JSON.parse(trimmed) as HistoryEntry);
    } catch {
      // a torn concurrent append/rewrite must not brick the whole history
      continue;
    }
  }
  return out;
}
