import type { Column } from "../sql/Column.ts";
import type { RunInfo } from "../sql/RunInfo.ts";

export type BindParams = Record<string, unknown>;

export type PreparedStatement = {
  all: (params?: BindParams) => readonly unknown[][];
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
