import clipboard from "clipboardy";
import { NoTabularOutcome, renderCsv } from "../../domain/schema/renderCsv.ts";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";

export { NoTabularOutcome };

export type CopyCsvResult = { rowsWritten: number };

export class CopyCsv {
  async run(outcome: QueryOutcome): Promise<CopyCsvResult> {
    if (outcome.kind !== "rows") throw new NoTabularOutcome("copy");
    const csv = renderCsv(
      outcome.columns.map((c) => c.name),
      outcome.rows,
    );
    await clipboard.write(csv);
    return { rowsWritten: outcome.rows.length };
  }
}
