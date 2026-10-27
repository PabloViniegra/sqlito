import { Box, render, type Key } from "ink";
import { describe, expect, it, vi } from "vitest";
import { usePromptInput } from "./usePromptInput.ts";
import { fakeStdin, fakeStdout } from "../../shared/utils/inkTestStreams.ts";

const settle = () => new Promise<void>((r) => setTimeout(r, 20));

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
