import { PassThrough } from "node:stream";
import { Box, render, type Key } from "ink";
import { describe, expect, it, vi } from "vitest";
import { usePromptInput } from "./usePromptInput.ts";

const settle = () => new Promise<void>((r) => setTimeout(r, 20));

type FakeStdin = NodeJS.ReadStream & {
  isTTY: boolean;
  setRawMode: (mode: boolean) => FakeStdin;
  ref: () => FakeStdin;
  unref: () => FakeStdin;
};

function fakeStdin(): FakeStdin {
  const stream = new PassThrough() as unknown as FakeStdin;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}

type FakeStdout = NodeJS.WriteStream & {
  isTTY: boolean;
  columns: number;
  rows: number;
};

function fakeStdout(): FakeStdout {
  const stream = new PassThrough() as unknown as FakeStdout;
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
  const instance = render(
    <Host overlayActive={overlayActive} onKey={onKey} />,
    {
      stdin: stdin as unknown as NodeJS.ReadStream,
      stdout: fakeStdout() as unknown as NodeJS.WriteStream,
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
