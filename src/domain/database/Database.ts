import type { Column } from "../sql/Column.ts";
import type { RunInfo } from "../sql/RunInfo.ts";

export type BindValue = string | number | bigint | boolean | Uint8Array | null;
export type SqliteValue = string | number | bigint | Uint8Array | null;
export type BindParams = Record<string, BindValue>;

export type StatementResult =
  | {
      kind: "rows";
      columns: readonly Column[];
      rows: readonly SqliteValue[][];
      /** more rows existed beyond the requested maxRows */
      truncated: boolean;
      /** statement does not mutate the database */
      readonly: boolean;
    }
  | ({ kind: "run" } & RunInfo);

export type ExecuteOptions = { maxRows?: number };

export type Database = {
  execute: (
    sql: string,
    params?: BindParams,
    options?: ExecuteOptions,
  ) => Promise<StatementResult>;
  /** Streams a read-only statement's full result into a CSV file. */
  exportCsv: (
    sql: string,
    params: BindParams,
    dest: string,
  ) => Promise<{ rowsWritten: number }>;
  /**
   * Abandons in-flight work. Returns false when nothing was running.
   * Connection-scoped state (open transactions, temp tables, ATTACH) is lost.
   */
  cancel: () => boolean;
  close: () => Promise<void>;
};

export class DatabaseError extends Error {
  readonly code: string | undefined;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}

export class QueryCancelled extends Error {
  constructor() {
    super("query cancelled");
    this.name = "QueryCancelled";
  }
}
