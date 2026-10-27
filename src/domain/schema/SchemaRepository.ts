import type { Table } from "./Table.ts";

/** Reads come from an in-memory snapshot; refresh() reloads it. */
export type SchemaRepository = {
  listTables: () => readonly Table[];
  describe: (name: string) => Table | undefined;
  refresh: () => Promise<void>;
};
