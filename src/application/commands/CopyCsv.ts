import clipboard from "clipboardy";
import { NoTabularOutcome, renderCsv } from "../../domain/schema/renderCsv.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export { NoTabularOutcome };

export type CopyCsvResult = { rowsWritten: number };
type ClipboardWriter = Pick<typeof clipboard, "write">;

export class CopyCsv {
  private readonly clipboardWriter: ClipboardWriter;

  constructor(clipboardWriter: ClipboardWriter = clipboard) {
    this.clipboardWriter = clipboardWriter;
  }

  async run(outcome: QueryOutcome): Promise<CopyCsvResult> {
    if (outcome.kind !== "rows") throw new NoTabularOutcome("copy");
    const csv = renderCsv(
      outcome.columns.map((c) => c.name),
      outcome.rows,
    );
    await this.clipboardWriter.write(csv);
    return { rowsWritten: outcome.rows.length };
  }
}
