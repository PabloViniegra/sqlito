import { render } from "ink";
import { PassThrough } from "node:stream";

export async function renderInkFrame(
  node: React.ReactElement,
  options: { columns?: number } = {},
): Promise<string> {
  // SAFETY: PassThrough is duck-typed as NodeJS.WriteStream at runtime; we attach `columns` and override `write` before Ink consumes it.
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
    columns: number;
  };
  let buffer = "";
  stdout.columns = options.columns ?? 80;
  stdout.write = (chunk: string | Uint8Array): boolean => {
    buffer += chunk.toString();
    return true;
  };
  // SAFETY: Ink's render accepts Node streams; the augmented PassThrough satisfies NodeJS.WriteStream at runtime.
  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  instance.unmount();
  return buffer;
}
