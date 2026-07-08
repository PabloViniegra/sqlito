import stringWidth from "string-width";

export type WrappedPrompt = {
  rows: readonly string[];
  cursorToPosition: (cursor: number) => { row: number; col: number };
  positionToCursor: (row: number, col: number) => number;
};

export function wrapPrompt({
  text,
  viewportColumns,
}: {
  text: string;
  viewportColumns: number;
}): WrappedPrompt {
  const width = Math.max(1, viewportColumns);

  // Break by display width (wide CJK glyphs count as 2 columns) and never
  // split a surrogate pair across rows — `for...of` iterates by codepoint.
  const rows: string[] = [];
  const rowStarts: number[] = [0];
  let rowText = "";
  let rowWidth = 0;
  let utf16Offset = 0;
  for (const ch of text) {
    const chWidth = Math.max(1, stringWidth(ch));
    if (rowWidth + chWidth > width && rowText !== "") {
      rows.push(rowText);
      rowStarts.push(utf16Offset);
      rowText = "";
      rowWidth = 0;
    }
    rowText += ch;
    rowWidth += chWidth;
    utf16Offset += ch.length;
  }
  rows.push(rowText);

  const lastRow = rows.length - 1;

  return {
    rows,
    // `col` is a UTF-16 offset relative to the row's own text (Prompt.tsx
    // slices the row string with it), not a display column.
    cursorToPosition: (cursor) => {
      if (text.length === 0) return { row: 0, col: 0 };
      const clamped = Math.min(Math.max(0, cursor), text.length);
      if (clamped >= text.length) {
        return { row: lastRow, col: text.length - rowStarts[lastRow]! };
      }
      let row = lastRow;
      for (let r = 0; r < rowStarts.length - 1; r++) {
        if (clamped < rowStarts[r + 1]!) {
          row = r;
          break;
        }
      }
      return { row, col: clamped - rowStarts[row]! };
    },
    positionToCursor: (row, col) => (rowStarts[row] ?? 0) + col,
  };
}
