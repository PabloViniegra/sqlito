import { PassThrough } from "node:stream";
import stripAnsi from "strip-ansi";

export type FakeStdout = PassThrough &
  NodeJS.WriteStream & {
    isTTY: boolean;
    columns: number;
    rows: number;
    /** Every raw write, ANSI included. */
    buffer: string;
    /** Non-blank writes with ANSI and carriage returns stripped. */
    frames: string[];
  };

export function fakeStdout(columns = 80, rows = 24): FakeStdout {
  // SAFETY: PassThrough is augmented below with every FakeStdout field the Ink runtime reads.
  const stream = new PassThrough() as FakeStdout;
  stream.isTTY = true;
  stream.columns = columns;
  stream.rows = rows;
  stream.buffer = "";
  stream.frames = [];
  stream.write = (chunk: string | Uint8Array): boolean => {
    const raw = chunk.toString();
    stream.buffer += raw;
    const text = stripAnsi(raw).replace(/\r/g, "");
    if (text.trim() !== "") stream.frames.push(text);
    return true;
  };
  return stream;
}

export type FakeStdin = PassThrough &
  NodeJS.ReadStream & {
    isTTY: boolean;
    setRawMode: (mode: boolean) => FakeStdin;
    ref: () => FakeStdin;
    unref: () => FakeStdin;
  };

export function fakeStdin(): FakeStdin {
  // SAFETY: PassThrough is augmented below with every FakeStdin field the Ink runtime reads.
  const stream = new PassThrough() as FakeStdin;
  stream.isTTY = true;
  stream.setRawMode = () => stream;
  stream.ref = () => stream;
  stream.unref = () => stream;
  return stream;
}
