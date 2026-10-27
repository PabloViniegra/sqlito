import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Database } from "../../domain/database/Database.ts";
import { NoTabularOutcome, renderCsv } from "../../domain/schema/renderCsv.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export { NoTabularOutcome };

export type ExportCsvResult = {
  rowsWritten: number;
  path: string;
  /** only the loaded rows were written (a truncated write statement can't be re-run) */
  partial: boolean;
};

export class ExportCsv {
  private readonly db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  async run(outcome: QueryOutcome, dest: string): Promise<ExportCsvResult> {
    if (outcome.kind !== "rows") throw new NoTabularOutcome("export");
    if (outcome.rerun !== undefined) {
      const { sql, params } = outcome.rerun;
      const { rowsWritten } = await this.db.exportCsv(sql, params, dest);
      return { rowsWritten, path: dest, partial: false };
    }
    await mkdir(dirname(dest), { recursive: true });
    const csv = renderCsv(
      outcome.columns.map((c) => c.name),
      outcome.rows,
    );
    await writeFile(dest, csv);
    return {
      rowsWritten: outcome.rows.length,
      path: dest,
      partial: outcome.truncated === true,
    };
  }
}
