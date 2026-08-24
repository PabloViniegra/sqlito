import BetterSqlite3 from "better-sqlite3";
import type {
  BindParams,
  Database,
  PreparedStatement,
} from "../../domain/database/Database.ts";
import type { Column } from "../../domain/sql/Column.ts";
import type { RunInfo } from "../../domain/sql/RunInfo.ts";

export type BetterSqliteDriver = BetterSqlite3.Database;

export class BetterSqliteDatabase implements Database {
  private readonly driver: BetterSqliteDriver;
  private readonly owned: boolean;
  readonly path: string;

  constructor(path: string) {
    this.driver = new BetterSqlite3(path);
    this.path = path;
    this.owned = true;
  }

  static withDriver(driver: BetterSqliteDriver): BetterSqliteDatabase {
    const instance = Object.create(BetterSqliteDatabase.prototype);
    Object.assign(instance, { driver, owned: false, path: ":shared:" });
    // SAFETY: instance has BetterSqliteDatabase.prototype, and Object.assign populated every constructor-assigned field.
    return instance as BetterSqliteDatabase;
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.driver.prepare(sql);
    return {
      reader: stmt.reader,
      readonly: stmt.readonly,
      all: (params?: BindParams) => {
        const columnNames = stmt.columns().map((c) => c.name);
        // SAFETY: better-sqlite3 returns row objects keyed by column name; we re-shape each into CellValue[] below.
        const rows = (
          params !== undefined ? stmt.all(params) : stmt.all()
        ) as Record<string, unknown>[];
        // SAFETY: columnNames is derived from stmt.columns(); each lookup is bounded by the declared columns.
        return rows.map((row) =>
          columnNames.map((name) => row[name]),
        ) as readonly unknown[][];
      },
      run: (params?: BindParams): RunInfo => {
        const info = params !== undefined ? stmt.run(params) : stmt.run();
        return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
      },
      columns: () =>
        // SAFETY: stmt.columns() yields Column definitions from SQLite; we project only name and type.
        stmt.columns().map((c) => ({
          name: c.name,
          type: c.type ?? null,
        })) as readonly Column[],
    };
  }

  close(): void {
    if (this.owned) this.driver.close();
  }
}
