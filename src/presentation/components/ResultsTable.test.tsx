import { render } from 'ink';
import { PassThrough } from 'node:stream';
import stripAnsi from 'strip-ansi';
import { describe, expect, it } from 'vitest';
import type { QueryOutcome } from '../../domain/sql/QueryOutcome.ts';
import { ResultsTable } from './ResultsTable.tsx';

async function capture(node: React.ReactElement): Promise<string> {
  const stdout = new PassThrough();
  let buffer = '';
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
  return stripAnsi(buffer).replace(/\r/g, '');
}

describe('ResultsTable', () => {
  it('renders rows outcome with header, separator, and rows', async () => {
    const outcome: QueryOutcome = {
      kind: 'rows',
      columns: [
        { name: 'id', type: null },
        { name: 'name', type: null },
      ],
      rows: [
        [1, 'Ada'],
        [2, 'Lin'],
      ],
    };

    const frame = await capture(
      <ResultsTable outcome={outcome} sql="SELECT id, name FROM t" />,
    );

    expect(frame).toContain('SELECT id, name FROM t');
    expect(frame).toContain('id');
    expect(frame).toContain('name');
    expect(frame).toContain('Ada');
    expect(frame).toContain('Lin');
    expect(frame.split('\n').filter((l) => l.length > 0).length).toBeGreaterThanOrEqual(4);
  });
});