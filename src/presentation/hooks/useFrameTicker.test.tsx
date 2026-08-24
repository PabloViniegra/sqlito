import { render, Text } from "ink";
import { PassThrough } from "node:stream";
import stripAnsi from "strip-ansi";
import { describe, expect, it } from "vitest";
import type { ReactElement } from "react";
import { shouldAnimateIntro, useFrameTicker } from "./useFrameTicker.ts";

const flush = (): Promise<void> =>
  new Promise<void>((resolve) => setImmediate(resolve));
const wait = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function makeStdout(): NodeJS.WriteStream & { buffer: string } {
  // SAFETY: PassThrough is duck-typed as NodeJS.WriteStream at runtime; we attach columns/isTTY and override write before Ink consumes it.
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
    columns: number;
    isTTY: boolean;
    buffer: string;
  };
  stdout.columns = 80;
  stdout.isTTY = true;
  stdout.buffer = "";
  stdout.write = (chunk: string | Uint8Array): boolean => {
    stdout.buffer += chunk.toString();
    return true;
  };
  return stdout;
}

async function mountProbe(enabled: boolean): Promise<{
  output: () => string;
  cleanup: () => Promise<void>;
}> {
  const stdout = makeStdout();
  // SAFETY: Ink's render accepts Node streams; the augmented PassThrough satisfies NodeJS.WriteStream at runtime.
  const instance = render(<Probe enabled={enabled} />, {
    stdout,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await flush();
  return {
    output: () => stripAnsi(stdout.buffer).replace(/\r/g, ""),
    cleanup: async () => {
      instance.unmount();
      await flush();
    },
  };
}

function Probe({ enabled }: { enabled: boolean }): ReactElement {
  const frame = useFrameTicker(5, enabled, [10, 10, 10, 20]);
  return <Text>{`frame=${frame}`}</Text>;
}

describe("useFrameTicker", () => {
  it("jumps straight to the final frame when disabled", async () => {
    const probe = await mountProbe(false);

    expect(probe.output()).toContain("frame=5");
    expect(probe.output()).not.toContain("frame=0");
    await probe.cleanup();
  });
  it("advances one frame per delay and stops at the end", async () => {
    const probe = await mountProbe(true);

    expect(probe.output()).toContain("frame=0");

    // Under load Ink coalesces intermediate paints; poll for the settle.
    let output = probe.output();
    for (let i = 0; i < 40 && !output.includes("frame=4"); i += 1) {
      await wait(50);
      output = probe.output();
    }
    expect(output).toContain("frame=4");

    const settled = probe.output();
    await wait(120);
    // the ticker cleared itself: no further frames were painted
    expect(probe.output().match(/frame=4/g)?.length).toBe(
      settled.match(/frame=4/g)?.length,
    );
    await probe.cleanup();
  });

  it("keeps automated renders deterministic", () => {
    expect(shouldAnimateIntro()).toBe(false);
  });
});
