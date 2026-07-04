import type {
  Database,
  PreparedStatement,
} from "../../domain/database/Database.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { isReadOnly } from "../../domain/sql/isReadOnly.ts";

export class ExecuteQuery {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  execute(sql: string): QueryOutcome {
    const trimmed = sql.trim();
    if (trimmed === "") return { kind: "error", message: "empty query" };

    let stmt: PreparedStatement;
    try {
      stmt = this.db.prepare(trimmed);
    } catch (err) {
      return this.toError(err);
    }

    try {
      if (isReadOnly(trimmed)) {
        const columns = stmt.columns();
        const rows = stmt.all();
        return { kind: "rows", columns, rows };
      }
      const info = stmt.run();
      return {
        kind: "affected",
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
      };
    } catch (err) {
      return this.toError(err);
    }
  }

  private toError(err: unknown): QueryOutcome {
    if (err instanceof Error) {
      const code =
        "code" in err && typeof (err as { code: unknown }).code === "string"
          ? (err as { code: string }).code
          : undefined;
      return code !== undefined
        ? { kind: "error", code, message: err.message }
        : { kind: "error", message: err.message };
    }
    return { kind: "error", message: String(err) };
  }
}
