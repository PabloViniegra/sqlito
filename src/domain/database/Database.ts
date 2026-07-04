import type { Column } from "../sql/Column.ts";
import type { RunInfo } from "../sql/RunInfo.ts";

export type PreparedStatement = {
  all: () => readonly unknown[][];
  run: () => RunInfo;
  columns: () => readonly Column[];
};

export type Database = {
  prepare: (sql: string) => PreparedStatement;
  close: () => void;
};
