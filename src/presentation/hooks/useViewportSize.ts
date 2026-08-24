import { useStdout } from "ink";
import { useEffect, useState } from "react";
import {
  normalizeTerminalColumns,
  normalizeTerminalRows,
} from "../layout/terminalDimensions.ts";

export type ViewportSize = {
  readonly columns: number;
  readonly rows: number;
};

export const DEFAULT_VIEWPORT: ViewportSize = { columns: 80, rows: 24 };

const DEBOUNCE_MS = 16;

function readSize(stdout: NodeJS.WriteStream | undefined): ViewportSize {
  const rawColumns = stdout?.columns;
  const rawRows = stdout?.rows;
  return {
    columns: normalizeTerminalColumns(
      rawColumns !== undefined && Number.isFinite(rawColumns) && rawColumns > 0
        ? rawColumns
        : DEFAULT_VIEWPORT.columns,
    ),
    rows: normalizeTerminalRows(
      rawRows !== undefined && Number.isFinite(rawRows) && rawRows > 0
        ? rawRows
        : DEFAULT_VIEWPORT.rows,
    ),
  };
}

export function useViewportSize(): ViewportSize {
  const { stdout } = useStdout();
  const [size, setSize] = useState<ViewportSize>(() => readSize(stdout));

  useEffect(() => {
    if (stdout === undefined) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onResize = (): void => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        setSize(readSize(stdout));
        timer = null;
      }, DEBOUNCE_MS);
    };
    stdout.on("resize", onResize);
    return () => {
      if (timer !== null) clearTimeout(timer);
      stdout.off("resize", onResize);
    };
  }, [stdout]);

  return size;
}
