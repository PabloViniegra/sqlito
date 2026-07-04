import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { escapeCsvField } from "../../domain/schema/escapeCsvField.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export class NoTabularOutcome extends Error {
  constructor() {
    super("No tabular result to export");
    this.name = "NoTabularOutcome";
  }
}

export type ExportCsvResult = {
  rowsWritten: number;
  path: string;
};

export class ExportCsv {
  async run(outcome: QueryOutcome, dest: string): Promise<ExportCsvResult> {
    if (outcome.kind !== "rows") throw new NoTabularOutcome();
    await mkdir(dirname(dest), { recursive: true });
    const csv = renderRows(
      outcome.columns.map((c) => c.name),
      outcome.rows,
    );
    await writeFile(dest, csv);
    return { rowsWritten: outcome.rows.length, path: dest };
  }
}

function renderRows(
  columnNames: readonly string[],
  rows: readonly unknown[][],
): string {
  const header = columnNames.map(escapeCsvField).join(",");
  const lines = rows.map((row) =>
    row.map((cell) => escapeCsvField(cell)).join(","),
  );
  return [header, ...lines].join("\n") + "\n";
}
