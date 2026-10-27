import type clipboard from "clipboardy";
import type { Database } from "../../domain/database/Database.ts";
import { NoTabularOutcome, renderCsv } from "../../domain/schema/renderCsv.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export { NoTabularOutcome };

export type CopyCsvResult = { rowsWritten: number };
type ClipboardWriter = Pick<typeof clipboard, "write">;

// importing clipboardy costs ~90 ms of cold start and only .copy needs it
const lazyClipboard: ClipboardWriter = {
  write: async (text) => (await import("clipboardy")).default.write(text),
};

export class CopyCsv {
  private readonly db: Database;
  private readonly clipboardWriter: ClipboardWriter;

  constructor(db: Database, clipboardWriter: ClipboardWriter = lazyClipboard) {
    this.db = db;
    this.clipboardWriter = clipboardWriter;
  }

  async run(outcome: QueryOutcome): Promise<CopyCsvResult> {
    if (outcome.kind !== "rows") throw new NoTabularOutcome("copy");
    let { columns, rows } = outcome;
    if (outcome.rerun !== undefined) {
      const full = await this.db.execute(
        outcome.rerun.sql,
        outcome.rerun.params,
      );
      if (full.kind === "rows") ({ columns, rows } = full);
    }
    const csv = renderCsv(
      columns.map((c) => c.name),
      rows,
    );
    await this.clipboardWriter.write(csv);
    return { rowsWritten: rows.length };
  }
}
