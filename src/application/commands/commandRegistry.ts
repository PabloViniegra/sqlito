import type { DotCommand } from "./parseCommand.ts";

export type CommandDescriptor = {
  name: string;
  description: string;
};

export const COMMAND_DESCRIPTORS: {
  [K in DotCommand["kind"]]: CommandDescriptor;
} = {
  tables: { name: ".tables", description: "List user tables" },
  schema: {
    name: ".schema [table]",
    description: "Show CREATE statements (all tables, or one + its indexes)",
  },
  indexes: { name: ".indexes", description: "List indexes with their table" },
  set: {
    name: ".set <name> <val>",
    description: "Define a session variable (use :name in queries)",
  },
  unset: { name: ".unset <name>", description: "Remove a session variable" },
  vars: { name: ".vars", description: "List active session variables" },
  explain: {
    name: ".explain",
    description: "Re-run the last query with EXPLAIN QUERY PLAN",
  },
  save: {
    name: ".save <name>",
    description: "Save the last query as a favorite",
  },
  favorites: { name: ".favorites", description: "List saved favorites" },
  run: {
    name: ".run <name>",
    description: "Load a favorite's SQL into the prompt",
  },
  forget: { name: ".forget <name>", description: "Delete a favorite" },
  export: {
    name: ".export <path>",
    description: "Export the last result to CSV",
  },
  help: { name: ".help", description: "Show this reference" },
  quit: {
    name: ".quit",
    description: "Close the database and exit (alias: .exit)",
  },
};
