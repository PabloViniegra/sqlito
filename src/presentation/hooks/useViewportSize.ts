import { useStdout } from "ink";
import { useEffect, useState } from "react";

export type ViewportSize = {
  readonly columns: number;
  readonly rows: number;
};

export const DEFAULT_VIEWPORT: ViewportSize = { columns: 80, rows: 24 };

const DEBOUNCE_MS = 16;

function readSize(stdout: NodeJS.WriteStream | undefined): ViewportSize {
  const columns = stdout?.columns ?? DEFAULT_VIEWPORT.columns;
  const rows = stdout?.rows ?? DEFAULT_VIEWPORT.rows;
  return {
    columns: columns || DEFAULT_VIEWPORT.columns,
    rows: rows || DEFAULT_VIEWPORT.rows,
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
