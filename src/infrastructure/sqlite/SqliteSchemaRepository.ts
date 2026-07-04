import type BetterSqlite3 from "better-sqlite3";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import type { Table } from "../../domain/schema/Table.ts";

export class SqliteSchemaRepository implements SchemaRepository {
  private readonly driver: BetterSqlite3.Database;

  constructor(driver: BetterSqlite3.Database) {
    this.driver = driver;
  }

  listTables(): readonly Table[] {
    const rows = this.driver
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
      )
      .all() as { name: string }[];
    return rows.map((row) => ({ name: row.name, columns: [] }));
  }

  describe(name: string): Table | undefined {
    const table = this.listTables().find((t) => t.name === name);
    if (table === undefined) return undefined;
    const cols = this.driver
      .prepare(`PRAGMA table_info(${quoteIdent(name)})`)
      .all() as {
      name: string;
      type: string | null;
    }[];
    return {
      name: table.name,
      columns: cols.map((c) => ({
        name: c.name,
        type: c.type === "" || c.type === null ? null : c.type,
      })),
    };
  }

  refresh(): void {}
}

function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
