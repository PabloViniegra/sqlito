import type { Table } from "./Table.ts";

export type SchemaRepository = {
  listTables: () => readonly Table[];
  describe: (name: string) => Table | undefined;
  refresh: () => void;
};
