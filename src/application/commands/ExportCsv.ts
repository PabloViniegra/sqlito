import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { NoTabularOutcome, renderCsv } from "../../domain/schema/renderCsv.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export { NoTabularOutcome };

export type ExportCsvResult = {
  rowsWritten: number;
  path: string;
};

export class ExportCsv {
  async run(outcome: QueryOutcome, dest: string): Promise<ExportCsvResult> {
    if (outcome.kind !== "rows") throw new NoTabularOutcome("export");
    await mkdir(dirname(dest), { recursive: true });
    const csv = renderCsv(
      outcome.columns.map((c) => c.name),
      outcome.rows,
    );
    await writeFile(dest, csv);
    return { rowsWritten: outcome.rows.length, path: dest };
  }
}
