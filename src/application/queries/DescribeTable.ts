import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import type { Table } from "../../domain/schema/Table.ts";

export class DescribeTable {
  private readonly schema: SchemaRepository;

  constructor(schema: SchemaRepository) {
    this.schema = schema;
  }

  describe(name: string): Table | undefined {
    return this.schema.describe(name);
  }
}
