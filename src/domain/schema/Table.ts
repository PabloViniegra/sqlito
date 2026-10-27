import type { Column } from "../sql/Column.ts";

export type { Column } from "../sql/Column.ts";

export type Table = {
  name: string;
  kind: "table" | "view";
  columns: readonly Column[];
};
