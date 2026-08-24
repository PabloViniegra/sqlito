import { useEffect, useState } from "react";

export function shouldAnimateIntro(
  stdout: NodeJS.WriteStream = process.stdout,
): boolean {
  // Terminal analogue of prefers-reduced-motion: honor NO_COLOR/TERM=dumb,
  // skip piped stdout, and keep automated renders deterministic.
  if (process.env.VITEST !== undefined) return false;
  if (process.env.NO_COLOR !== undefined) return false;
  if (process.env.TERM === "dumb") return false;
  return stdout.isTTY === true;
}

/**
 * Walks frame 0..totalFrames, spending delays[i] ms between frame i and
 * i+1. Missing trailing delays fall back to the last known value.
 */
export function useFrameTicker(
  totalFrames: number,
  enabled: boolean,
  delays: readonly number[],
): number {
  const [frame, setFrame] = useState(() => (enabled ? 0 : totalFrames));

  useEffect(() => {
    if (!enabled || totalFrames <= 1) return;
    let tick = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const schedule = (from: number): void => {
      timer = setTimeout(
        () => {
          if (cancelled) return;
          tick += 1;
          // max() guards against Strict Mode remounts rewinding the frame.
          setFrame((prev) => Math.max(prev, Math.min(tick, totalFrames)));
          if (tick < totalFrames - 1) schedule(tick);
        },
        delays[from] ?? delays[delays.length - 1] ?? 0,
      );
    };
    schedule(0);
    return () => {
      cancelled = true;
      if (timer !== null) clearTimeout(timer);
    };
  }, [enabled, totalFrames, delays]);

  return enabled ? Math.min(frame, totalFrames) : totalFrames;
}
