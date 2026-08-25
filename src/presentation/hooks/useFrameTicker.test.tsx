import { render, Text } from "ink";
import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { useEffect } from "react";
import { shouldAnimateIntro, useFrameTicker } from "./useFrameTicker.ts";

const flush = (): Promise<void> =>
  new Promise<void>((resolve) => setImmediate(resolve));
const wait = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function makeStdout(): NodeJS.WriteStream {
  // SAFETY: PassThrough is duck-typed as NodeJS.WriteStream at runtime; Ink only needs a writable stream because assertions read the frame log, not ANSI output.
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
    columns: number;
    rows: number;
    isTTY: boolean;
  };
  stdout.columns = 80;
  stdout.rows = 24;
  stdout.isTTY = true;
  return stdout;
}

async function mountProbe(
  enabled: boolean,
  log: number[],
): Promise<{ cleanup: () => Promise<void> }> {
  // SAFETY: Ink's render accepts Node streams; the augmented PassThrough satisfies NodeJS.WriteStream at runtime.
  const instance = render(<Probe enabled={enabled} log={log} />, {
    stdout: makeStdout(),
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await flush();
  return {
    cleanup: async () => {
      instance.unmount();
      await flush();
    },
  };
}

function Probe({
  enabled,
  log,
}: {
  enabled: boolean;
  log: number[];
}): ReactElement {
  const frame = useFrameTicker(5, enabled, [10, 10, 10, 20]);
  useEffect(() => {
    log.push(frame);
  }, [frame, log]);
  return <Text>{String(frame)}</Text>;
}

describe("useFrameTicker", () => {
  it("jumps straight to the final frame when disabled", async () => {
    const log: number[] = [];
    const probe = await mountProbe(false, log);

    expect(log).toEqual([5]);
    await probe.cleanup();
  });

  it("advances monotonically and stops at the final frame", async () => {
    const log: number[] = [];
    const probe = await mountProbe(true, log);

    let settled = false;
    for (let i = 0; i < 40 && !settled; i += 1) {
      await wait(50);
      settled = log[log.length - 1] === 4;
    }
    expect(settled).toBe(true);

    // monotonic walk: every frame was visited in order
    expect(log).toEqual([0, 1, 2, 3, 4]);

    const count = log.length;
    await wait(120);
    // the ticker cleared itself once the final frame rendered
    expect(log.length).toBe(count);
    await probe.cleanup();
  });

  it("keeps automated renders deterministic", () => {
    expect(shouldAnimateIntro()).toBe(false);
  });
});
