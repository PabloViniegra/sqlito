import type { Database } from "../../domain/database/Database.ts";

export type SchemaResult =
  { ok: true; text: string } | { ok: false; error: string };

const USER_OBJECT = "name NOT LIKE 'sqlite_%'";

export class SchemaPrettyPrint {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  tables(): string {
    const rows = this.db
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND ${USER_OBJECT} ORDER BY name`,
      )
      .all();
    if (rows.length === 0) return "No tables";
    return rows.map((row) => String(row[0])).join("\n");
  }

  indexes(): string {
    const rows = this.db
      .prepare(
        `SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND ${USER_OBJECT} AND sql IS NOT NULL ORDER BY tbl_name, name`,
      )
      .all();
    if (rows.length === 0) return "No indexes";
    return rows
      .map((row) => `${String(row[0])} on ${String(row[1])}`)
      .join("\n");
  }

  schema(table?: string): SchemaResult {
    if (table === undefined) {
      const rows = this.db
        .prepare(
          `SELECT sql FROM sqlite_master WHERE type='table' AND ${USER_OBJECT} AND sql IS NOT NULL ORDER BY name`,
        )
        .all();
      if (rows.length === 0) return { ok: true, text: "No tables" };
      return {
        ok: true,
        text: rows.map((row) => `${String(row[0])};`).join("\n\n"),
      };
    }

    const tableRows = this.db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name = :name AND ${USER_OBJECT}`,
      )
      .all({ name: table });
    if (tableRows.length === 0) {
      return { ok: false, error: `unknown table: ${table}` };
    }

    const indexRows = this.db
      .prepare(
        `SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name = :name AND ${USER_OBJECT} AND sql IS NOT NULL ORDER BY name`,
      )
      .all({ name: table });

    const statements = [
      String(tableRows[0][0]),
      ...indexRows.map((row) => String(row[0])),
    ];
    return { ok: true, text: statements.map((s) => `${s};`).join("\n\n") };
  }
}
