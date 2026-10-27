import type {
  BindParams,
  Database,
  SqliteValue,
} from "../../domain/database/Database.ts";

export type SchemaResult =
  { ok: true; text: string } | { ok: false; error: string };

const USER_OBJECT = "name NOT LIKE 'sqlite_%'";
const TABLE_OR_VIEW = "type IN ('table','view')";

export class SchemaPrettyPrint {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async tables(): Promise<string> {
    const rows = await this.rows(
      `SELECT name FROM sqlite_master WHERE ${TABLE_OR_VIEW} AND ${USER_OBJECT} ORDER BY name`,
    );
    if (rows.length === 0) return "No tables";
    return rows.map((row) => String(row[0])).join("\n");
  }

  async indexes(): Promise<string> {
    const rows = await this.rows(
      `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND ${USER_OBJECT} AND sql IS NOT NULL ORDER BY tbl_name, name`,
    );
    if (rows.length === 0) return "No indexes";
    return rows
      .map((row) => `${String(row[0])} on ${String(row[1])}`)
      .join("\n");
  }

  async schema(table?: string): Promise<SchemaResult> {
    if (table === undefined) {
      const rows = await this.rows(
        `SELECT sql FROM sqlite_master WHERE ${TABLE_OR_VIEW} AND ${USER_OBJECT} AND sql IS NOT NULL ORDER BY name`,
      );
      if (rows.length === 0) return { ok: true, text: "No tables" };
      return {
        ok: true,
        text: rows.map((row) => `${String(row[0])};`).join("\n\n"),
      };
    }

    const tableRows = await this.rows(
      `SELECT sql FROM sqlite_master WHERE ${TABLE_OR_VIEW} AND name = :name AND ${USER_OBJECT}`,
      { name: table },
    );
    if (tableRows.length === 0) {
      return { ok: false, error: `unknown table: ${table}` };
    }

    const indexRows = await this.rows(
      `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name = :name AND ${USER_OBJECT} AND sql IS NOT NULL ORDER BY name`,
      { name: table },
    );

    const statements = [
      String(tableRows[0][0]),
      ...indexRows.map((row) => String(row[0])),
    ];
    return { ok: true, text: statements.map((s) => `${s};`).join("\n\n") };
  }

  private async rows(
    sql: string,
    params?: BindParams,
  ): Promise<readonly SqliteValue[][]> {
    const result = await this.db.execute(sql, params);
    return result.kind === "rows" ? result.rows : [];
  }
}
