import type { Column } from "../sql/Column.ts";

export type { Column } from "../sql/Column.ts";

export type Table = {
  name: string;
  columns: readonly Column[];
};
