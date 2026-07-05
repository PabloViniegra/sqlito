import { describe, expect, it } from "vitest";
import { HELP_TEXT } from "./helpText.ts";

const EXPECTED_HELP_TEXT = [
  "Commands:",
  "  .tables            List user tables",
  "  .schema [table]    Show CREATE statements (all tables, or one + its indexes)",
  "  .indexes           List indexes with their table",
  "  .set <name> <val>  Define a session variable (use :name in queries)",
  "  .unset <name>      Remove a session variable",
  "  .vars              List active session variables",
  "  .explain           Re-run the last query with EXPLAIN QUERY PLAN",
  "  .save <name>       Save the last query as a favorite",
  "  .favorites         List saved favorites",
  "  .run <name>        Load a favorite's SQL into the prompt",
  "  .forget <name>     Delete a favorite",
  "  .theme <name>      Switch the active theme (default, high-contrast)",
  "  .export <path>     Export the last result to CSV",
  "  .help              Show this reference",
  "  .quit              Close the database and exit (alias: .exit)",
].join("\n");

describe("HELP_TEXT", () => {
  it("matches the reference command list byte-for-byte", () => {
    expect(HELP_TEXT).toBe(EXPECTED_HELP_TEXT);
  });
});
