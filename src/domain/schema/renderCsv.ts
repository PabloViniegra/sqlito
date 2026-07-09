import { escapeCsvField } from "./escapeCsvField.ts";

export function renderCsv(
  columnNames: readonly string[],
  rows: readonly unknown[][],
): string {
  const header = columnNames.map(escapeCsvField).join(",");
  const lines = rows.map((row) =>
    row.map((cell) => escapeCsvField(cell)).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}

export class NoTabularOutcome extends Error {
  constructor(action: "export" | "copy") {
    super(`No tabular result to ${action}`);
    this.name = "NoTabularOutcome";
  }
}
