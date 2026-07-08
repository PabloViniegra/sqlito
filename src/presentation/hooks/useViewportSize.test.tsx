import { PassThrough } from "node:stream";
import type { Instance } from "ink";
import { Text, render } from "ink";
import { useEffect, useRef } from "react";
import { describe, expect, it } from "vitest";
import type { ViewportSize } from "./useViewportSize.ts";
import { useViewportSize } from "./useViewportSize.ts";

type FakeTty = NodeJS.WriteStream & {
  columns: number;
  rows: number;
  isTTY: boolean;
};

function fakeTty(columns: number, rows: number): FakeTty {
  const stream = new PassThrough() as unknown as FakeTty;
  stream.columns = columns;
  stream.rows = rows;
  stream.isTTY = true;
  return stream;
}

async function nextTick(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

type Sink = { current: ViewportSize | null; renders: number };

function Probe({ sink }: { sink: Sink }): React.ReactElement {
  const size = useViewportSize();
  const last = useRef(size);
  useEffect(() => {
    if (
      last.current.columns !== size.columns ||
      last.current.rows !== size.rows
    ) {
      sink.renders += 1;
      last.current = size;
    }
  }, [size, sink]);
  sink.current = size;
  return <Text>{`${size.columns}x${size.rows}`}</Text>;
}

async function mount(tty: FakeTty, sink: Sink): Promise<Instance> {
  const instance = render(<Probe sink={sink} />, {
    stdout: tty as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await nextTick();
  return instance;
}

describe("useViewportSize", () => {
  it("returns the documented default when stdout reports no dimensions", async () => {
    const tty = fakeTty(0, 0);
    const sink: Sink = { current: null, renders: 0 };
    const instance = await mount(tty, sink);

    expect(sink.current).toEqual({ columns: 80, rows: 24 });

    instance.unmount();
    await nextTick();
  });

  it("returns stdout dimensions when both columns and rows are positive", async () => {
    const tty = fakeTty(120, 40);
    const sink: Sink = { current: null, renders: 0 };
    const instance = await mount(tty, sink);

    expect(sink.current).toEqual({ columns: 120, rows: 40 });

    instance.unmount();
    await nextTick();
  });

  it("updates to the new size when stdout emits a resize event", async () => {
    const tty = fakeTty(80, 24);
    const sink: Sink = { current: null, renders: 0 };
    const instance = await mount(tty, sink);

    tty.columns = 200;
    tty.rows = 60;
    tty.emit("resize");
    await new Promise<void>((resolve) => setTimeout(resolve, 40));

    expect(sink.current).toEqual({ columns: 200, rows: 60 });

    instance.unmount();
    await nextTick();
  });

  it("collapses back-to-back resize events into one update with the latest size", async () => {
    const tty = fakeTty(80, 24);
    const sink: Sink = { current: null, renders: 0 };
    const instance = await mount(tty, sink);

    const initialRenders = sink.renders;
    tty.columns = 100;
    tty.rows = 30;
    tty.emit("resize");
    tty.columns = 140;
    tty.rows = 35;
    tty.emit("resize");
    tty.columns = 200;
    tty.rows = 60;
    tty.emit("resize");
    await new Promise<void>((resolve) => setTimeout(resolve, 60));

    expect(sink.renders - initialRenders).toBe(1);
    expect(sink.current).toEqual({ columns: 200, rows: 60 });

    instance.unmount();
    await nextTick();
  });

  it("does not apply the new size until the debounce window has elapsed", async () => {
    const tty = fakeTty(80, 24);
    const sink: Sink = { current: null, renders: 0 };
    const instance = await mount(tty, sink);

    tty.columns = 200;
    tty.rows = 60;
    tty.emit("resize");

    await new Promise<void>((resolve) => setTimeout(resolve, 10));
    expect(sink.current).toEqual({ columns: 80, rows: 24 });

    await new Promise<void>((resolve) => setTimeout(resolve, 40));
    expect(sink.current).toEqual({ columns: 200, rows: 60 });

    instance.unmount();
    await nextTick();
  });

  it("stops listening for resize after unmount and ignores late events", async () => {
    const tty = fakeTty(80, 24);
    const sink: Sink = { current: null, renders: 0 };
    const instance = await mount(tty, sink);

    tty.columns = 200;
    tty.rows = 60;
    tty.emit("resize");

    instance.unmount();
    await nextTick();

    tty.columns = 999;
    tty.rows = 999;
    expect(() => tty.emit("resize")).not.toThrow();

    await new Promise<void>((resolve) => setTimeout(resolve, 40));

    expect(sink.current).toEqual({ columns: 80, rows: 24 });
  });
});
