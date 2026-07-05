import { render } from "ink";
import { PassThrough } from "node:stream";

export async function renderInkFrame(
  node: React.ReactElement,
  options: { columns?: number } = {},
): Promise<string> {
  const stdout = new PassThrough() as unknown as NodeJS.WriteStream & {
    columns: number;
  };
  let buffer = "";
  stdout.columns = options.columns ?? 80;
  stdout.write = (chunk: string | Uint8Array): boolean => {
    buffer += chunk.toString();
    return true;
  };
  const instance = render(node, {
    stdout: stdout as unknown as NodeJS.WriteStream,
    exitOnCtrlC: false,
    patchConsole: false,
  });
  await new Promise<void>((resolve) => setImmediate(resolve));
  instance.unmount();
  return buffer;
}
