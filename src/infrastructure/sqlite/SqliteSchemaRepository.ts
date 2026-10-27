import type { Database, SqliteValue } from "../../domain/database/Database.ts";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import type { Table } from "../../domain/schema/Table.ts";

const OBJECTS_SQL =
  "SELECT name, type FROM sqlite_master WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' ORDER BY name";

const SNAPSHOT_SQL = `SELECT m.name, m.type, p.name, p.type
  FROM sqlite_master m LEFT JOIN pragma_table_info(m.name) p
  WHERE m.type IN ('table','view') AND m.name NOT LIKE 'sqlite_%'
  ORDER BY m.name, p.cid`;

export class SqliteSchemaRepository implements SchemaRepository {
  private readonly db: Database;
  private tables: readonly Table[] = [];
  private byName = new Map<string, Table>();
  private generation = 0;

  constructor(db: Database) {
    this.db = db;
  }

  listTables(): readonly Table[] {
    return this.tables;
  }

  describe(name: string): Table | undefined {
    return this.byName.get(name);
  }

  async refresh(): Promise<void> {
    const generation = ++this.generation;
    let tables: Table[];
    try {
      tables = await this.load();
    } catch {
      // callers fire and forget; a cancelled, closed or unreadable connection
      // keeps the last snapshot instead of crashing the app
      return;
    }
    // an older refresh resolving late must not overwrite a newer snapshot
    if (generation !== this.generation) return;
    this.tables = tables;
    this.byName = new Map(tables.map((t) => [t.name, t]));
  }

  private async load(): Promise<Table[]> {
    try {
      return groupSnapshot(await rowsOf(this.db, SNAPSHOT_SQL));
    } catch {
      // a view over a dropped table makes pragma_table_info fail for the
      // whole join, so fall back to describing objects one by one
      return this.loadEachObject();
    }
  }

  private async loadEachObject(): Promise<Table[]> {
    const objects = await rowsOf(this.db, OBJECTS_SQL);
    const tables: Table[] = [];
    for (const [name, type] of objects) {
      const columns = await rowsOf(
        this.db,
        "SELECT name, type FROM pragma_table_info(:name) ORDER BY cid",
        { name: String(name) },
      ).catch(() => []);
      tables.push({
        name: String(name),
        kind: type === "view" ? "view" : "table",
        columns: columns.map(([col, colType]) => ({
          name: String(col),
          type: declaredType(colType),
        })),
      });
    }
    return tables;
  }
}

async function rowsOf(
  db: Database,
  sql: string,
  params: Record<string, string> = {},
): Promise<readonly SqliteValue[][]> {
  const result = await db.execute(sql, params);
  return result.kind === "rows" ? result.rows : [];
}

function groupSnapshot(rows: readonly SqliteValue[][]): Table[] {
  const tables: Table[] = [];
  let current:
    | { name: string; kind: Table["kind"]; columns: Table["columns"][number][] }
    | undefined;
  for (const [name, type, column, columnType] of rows) {
    if (current?.name !== name) {
      current = {
        name: String(name),
        kind: type === "view" ? "view" : "table",
        columns: [],
      };
      tables.push(current);
    }
    if (column !== null) {
      current.columns.push({
        name: String(column),
        type: declaredType(columnType),
      });
    }
  }
  return tables;
}

function declaredType(value: SqliteValue): string | null {
  return value === null || value === "" ? null : String(value);
}
