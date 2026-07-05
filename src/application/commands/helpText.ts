export const HELP_TEXT = [
  "Commands:",
  "  .tables            List user tables",
  "  .schema [table]    Show CREATE statements (all tables, or one + its indexes)",
  "  .indexes           List indexes with their table",
  "  .export <path>     Export the last result to CSV",
  "  .help              Show this reference",
  "  .quit              Close the database and exit (alias: .exit)",
].join("\n");
