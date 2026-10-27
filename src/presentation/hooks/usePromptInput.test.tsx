import { PassThrough } from "node:stream";
import { Box, render, type Key } from "ink";
import { describe, expect, it, vi } from "vitest";
import { usePromptInput } from "./usePromptInput.ts";

const settle = () => new Promise<void>((r) => setTimeout(r, 20));

type FakeStdin = PassThrough &
  NodeJS.ReadStream & {
    isTTY: boolean;
    setRawMode: (mode: boolean) => FakeStdin;
    ref: () => FakeStdin;
    unref: () => FakeStdin;
  };

function fakeStdin(): FakeStdin {
  // SAFETY: PassThrough is duck-typed with NodeJS.ReadStream at runtime; this test fixture mutates isTTY/setRawMode/ref/unref before Ink consumes it.
  const stream = new PassThrough() as FakeStdin;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}

type FakeStdout = PassThrough &
  NodeJS.WriteStream & {
    isTTY: boolean;
    columns: number;
    rows: number;
  };

function fakeStdout(): FakeStdout {
  // SAFETY: PassThrough is duck-typed with NodeJS.WriteStream at runtime; this test fixture mutates isTTY/columns/rows/write before Ink consumes it.
  const stream = new PassThrough() as FakeStdout;
  stream.isTTY = true;
  stream.columns = 80;
  stream.rows = 24;
  stream.write = () => true;
  return stream;
}

function Host({
  overlayActive,
  onKey,
}: {
  overlayActive: boolean;
  onKey: (input: string, key: Key) => void;
}) {
  usePromptInput(overlayActive, onKey);
  return <Box />;
}

async function mountHost(overlayActive: boolean) {
  const onKey = vi.fn();
  const stdin = fakeStdin();
  // SAFETY: Ink's render accepts Node streams; FakeStdin/FakeStdout satisfy that surface at runtime after the fixture mutations above.
  const instance = render(
    <Host overlayActive={overlayActive} onKey={onKey} />,
    {
      stdin,
      stdout: fakeStdout(),
      exitOnCtrlC: false,
      patchConsole: false,
    },
  );
  await settle();
  return {
    onKey,
    async send(data: string) {
      stdin.write(data);
      await settle();
    },
    cleanup() {
      instance.unmount();
    },
  };
}

describe("usePromptInput", () => {
  it("invokes the callback when no overlay is active", async () => {
    const host = await mountHost(false);
    try {
      await host.send("a");
      expect(host.onKey).toHaveBeenCalledTimes(1);
      expect(host.onKey.mock.calls[0]?.[0]).toBe("a");
    } finally {
      host.cleanup();
    }
  });

  it("swallows the key (never invokes the callback) when an overlay is active", async () => {
    const host = await mountHost(true);
    try {
      await host.send("a");
      expect(host.onKey).not.toHaveBeenCalled();
    } finally {
      host.cleanup();
    }
  });
});
