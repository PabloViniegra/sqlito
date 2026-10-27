import BetterSqlite3 from "better-sqlite3";
import { randomUUID } from "node:crypto";
import {
  closeSync,
  mkdirSync,
  openSync,
  renameSync,
  rmSync,
  writeSync,
} from "node:fs";
import { dirname } from "node:path";
import type {
  BindParams,
  SqliteValue,
  StatementResult,
} from "../../domain/database/Database.ts";
import { escapeCsvField } from "../../domain/schema/escapeCsvField.ts";

export type BetterSqliteDriver = BetterSqlite3.Database;

const CSV_FLUSH_ROWS = 1000;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
const MIN_SAFE = BigInt(Number.MIN_SAFE_INTEGER);

/**
 * Synchronous core shared by the in-process adapter and the worker process.
 * Integers are read as bigint so values beyond 2^53 survive, then narrowed
 * back to number when they fit.
 */
export class SqliteEngine {
  private readonly driver: BetterSqliteDriver;
  private readonly owned: boolean;

  constructor(source: string | BetterSqliteDriver, { readonly = false } = {}) {
    this.owned = !(source instanceof BetterSqlite3);
    this.driver =
      source instanceof BetterSqlite3
        ? source
        : new BetterSqlite3(source, { readonly });
  }

  exec(sql: string): void {
    this.driver.exec(sql);
  }

  execute(sql: string, params: BindParams, maxRows: number): StatementResult {
    const stmt = this.driver.prepare(sql).safeIntegers(true);
    if (!stmt.reader) {
      const info = stmt.run(params);
      return {
        kind: "run",
        changes: info.changes,
        lastInsertRowid: narrow(info.lastInsertRowid),
      };
    }
    stmt.raw(true);
    const columns = stmt.columns().map((c) => ({ name: c.name, type: c.type }));
    const rows: SqliteValue[][] = [];
    let truncated = false;
    for (const row of iterateWith(stmt, params)) {
      if (rows.length >= maxRows) {
        truncated = true;
        break;
      }
      rows.push(narrowRow(row));
    }
    return { kind: "rows", columns, rows, truncated, readonly: stmt.readonly };
  }

  exportCsv(sql: string, params: BindParams, dest: string): number {
    const stmt = this.driver.prepare(sql).safeIntegers(true);
    if (!stmt.reader || !stmt.readonly) {
      throw new Error("only read-only queries can be re-run for export");
    }
    stmt.raw(true);
    mkdirSync(dirname(dest), { recursive: true });
    // stream into a sibling file so a failed or cancelled export never
    // clobbers an existing destination
    const tmp = `${dest}.${randomUUID()}.tmp`;
    const fd = openSync(tmp, "w");
    let rowsWritten = 0;
    try {
      const header = stmt.columns().map((c) => escapeCsvField(c.name));
      let chunk = header.join(",") + "\n";
      for (const row of iterateWith(stmt, params)) {
        chunk += narrowRow(row).map(escapeCsvField).join(",") + "\n";
        rowsWritten++;
        if (rowsWritten % CSV_FLUSH_ROWS === 0) {
          writeSync(fd, chunk);
          chunk = "";
        }
      }
      writeSync(fd, chunk);
    } catch (err) {
      closeSync(fd);
      rmSync(tmp, { force: true });
      throw err;
    }
    closeSync(fd);
    renameSync(tmp, dest);
    return rowsWritten;
  }

  close(): void {
    if (this.owned) this.driver.close();
  }
}

function iterateWith(
  stmt: BetterSqlite3.Statement,
  params: BindParams,
): IterableIterator<SqliteValue[]> {
  // SAFETY: raw(true) makes better-sqlite3 yield each row as an array of SQLite values.
  return stmt.iterate(params) as IterableIterator<SqliteValue[]>;
}

function narrowRow(row: SqliteValue[]): SqliteValue[] {
  for (let i = 0; i < row.length; i++) row[i] = narrow(row[i]);
  return row;
}

function narrow<T>(value: T): T | number {
  if (typeof value === "bigint" && value <= MAX_SAFE && value >= MIN_SAFE) {
    return Number(value);
  }
  return value;
}
