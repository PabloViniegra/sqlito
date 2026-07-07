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
  const rows: string[] = [];
  for (let i = 0; i < text.length; i += width) {
    rows.push(text.slice(i, i + width));
  }
  if (rows.length === 0) rows.push("");
  return {
    rows,
    cursorToPosition: (cursor) => {
      if (text.length === 0) return { row: 0, col: 0 };
      const clamped = Math.min(Math.max(0, cursor), text.length);
      const lastRow = rows.length - 1;
      const lastRowStart = lastRow * width;
      if (clamped >= text.length) {
        return { row: lastRow, col: text.length - lastRowStart };
      }
      return { row: Math.floor(clamped / width), col: clamped % width };
    },
    positionToCursor: (row, col) => row * width + col,
  };
}
