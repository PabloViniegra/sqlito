import type { Column } from "../sql/Column.ts";
import type { RunInfo } from "../sql/RunInfo.ts";

export type BindParams = Record<string, unknown>;

export type PreparedStatement = {
  all: (params?: BindParams) => readonly unknown[][];
  run: (params?: BindParams) => RunInfo;
  columns: () => readonly Column[];
};

export type Database = {
  prepare: (sql: string) => PreparedStatement;
  close: () => void;
};
