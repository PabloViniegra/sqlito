import { describe, expect, it } from "vitest";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import type { Table } from "../../domain/schema/Table.ts";
import { DescribeTable } from "./DescribeTable.ts";

const stubSchema = (tables: readonly Table[]): SchemaRepository => ({
  listTables: () => tables,
  describe: (name: string) => tables.find((t) => t.name === name),
  refresh: () => {},
});

const USERS_TABLE: Table = {
  name: "users",
  columns: [
    { name: "id", type: "INTEGER" },
    { name: "email", type: "TEXT" },
  ],
};

const POSTS_TABLE: Table = {
  name: "posts",
  columns: [{ name: "id", type: "INTEGER" }],
};

describe("DescribeTable", () => {
  it("returns the matching Table when the schema has it", () => {
    const sut = new DescribeTable(stubSchema([USERS_TABLE, POSTS_TABLE]));

    expect(sut.describe("users")).toEqual(USERS_TABLE);
  });

  it("returns undefined when the schema does not have the table", () => {
    const sut = new DescribeTable(stubSchema([USERS_TABLE]));

    expect(sut.describe("comments")).toBeUndefined();
  });

  it("returns an empty-columns table for tables the schema knows about", () => {
    const sut = new DescribeTable(stubSchema([{ name: "loose", columns: [] }]));

    expect(sut.describe("loose")).toEqual({ name: "loose", columns: [] });
  });
});
