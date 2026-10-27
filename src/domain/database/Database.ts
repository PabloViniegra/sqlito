import type { Column } from "../sql/Column.ts";
import type { RunInfo } from "../sql/RunInfo.ts";

export type BindValue = string | number | bigint | boolean | Uint8Array | null;
export type SqliteValue = string | number | bigint | Uint8Array | null;
export type BindParams = Record<string, BindValue>;

export type PreparedStatement = {
  all: (params?: BindParams) => readonly SqliteValue[][];
  run: (params?: BindParams) => RunInfo;
  columns: () => readonly Column[];
  /** statement returns data (drives all() vs run()) */
  reader: boolean;
  /** statement does not mutate the database */
  readonly: boolean;
};

export type Database = {
  prepare: (sql: string) => PreparedStatement;
  close: () => void;
};
