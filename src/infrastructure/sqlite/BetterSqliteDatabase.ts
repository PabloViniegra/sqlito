import BetterSqlite3 from 'better-sqlite3';
import type { Database, PreparedStatement } from '../../domain/database/Database.ts';
import type { Column } from '../../domain/sql/Column.ts';
import type { RunInfo } from '../../domain/sql/RunInfo.ts';

export class BetterSqliteDatabase implements Database {
  private readonly driver: BetterSqlite3.Database;
  readonly path: string;

  constructor(path: string) {
    this.driver = new BetterSqlite3(path);
    this.path = path;
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.driver.prepare(sql);
    return {
      all: () => {
        const columnNames = stmt.columns().map((c) => c.name);
        const rows = stmt.all() as Record<string, unknown>[];
        return rows.map((row) => columnNames.map((name) => row[name])) as readonly unknown[][];
      },
      run: (): RunInfo => {
        const info = stmt.run();
        return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
      },
      columns: () =>
        stmt.columns().map((c) => ({ name: c.name, type: c.type ?? null })) as readonly Column[],
    };
  }

  close(): void {
    this.driver.close();
  }
}