import type {
  BindParams,
  Database,
  ExecuteOptions,
  StatementResult,
} from "../../domain/database/Database.ts";
import { SqliteEngine, type BetterSqliteDriver } from "./SqliteEngine.ts";
import { toDatabaseError } from "./toDatabaseError.ts";

/**
 * In-process adapter: runs on the caller's thread, so it cannot cancel.
 * Production uses WorkerDatabase; this one backs tests and seeding.
 */
export class BetterSqliteDatabase implements Database {
  private readonly engine: SqliteEngine;

  constructor(source: string | BetterSqliteDriver) {
    this.engine = new SqliteEngine(source);
  }

  exec(sql: string): void {
    this.engine.exec(sql);
  }

  async execute(
    sql: string,
    params: BindParams = {},
    options: ExecuteOptions = {},
  ): Promise<StatementResult> {
    try {
      return this.engine.execute(sql, params, options.maxRows ?? Infinity);
    } catch (err) {
      throw toDatabaseError(err);
    }
  }

  async exportCsv(
    sql: string,
    params: BindParams,
    dest: string,
  ): Promise<{ rowsWritten: number }> {
    try {
      return { rowsWritten: this.engine.exportCsv(sql, params, dest) };
    } catch (err) {
      throw toDatabaseError(err);
    }
  }

  cancel(): boolean {
    return false;
  }

  async close(): Promise<void> {
    this.engine.close();
  }
}
