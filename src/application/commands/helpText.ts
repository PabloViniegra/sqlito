export const HELP_TEXT = [
  "Commands:",
  "  .tables            List user tables",
  "  .schema [table]    Show CREATE statements (all tables, or one + its indexes)",
  "  .indexes           List indexes with their table",
  "  .set <name> <val>  Define a session variable (use :name in queries)",
  "  .unset <name>      Remove a session variable",
  "  .vars              List active session variables",
  "  .export <path>     Export the last result to CSV",
  "  .help              Show this reference",
  "  .quit              Close the database and exit (alias: .exit)",
].join("\n");
