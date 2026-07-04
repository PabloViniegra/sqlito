import { describe, expect, it } from 'vitest';
import { formatRows } from './formatRows.ts';

describe('formatRows', () => {
  it('renders header, separator, and left-aligned rows', () => {
    const lines = formatRows(
      [
        { name: 'id', type: null },
        { name: 'name', type: null },
      ],
      [
        [1, 'Ada'],
        [2, 'Lin'],
      ],
    );

    expect(lines).toEqual([
      'id  name',
      '--  ----',
      '1   Ada ',
      '2   Lin ',
    ]);
  });

  it('returns just a header when rows are empty', () => {
    const lines = formatRows([{ name: 'x', type: null }], []);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('x');
    expect(lines[1]).toBe('-');
  });

  it('handles a single column', () => {
    const lines = formatRows([{ name: 'only', type: null }], [['a'], ['bb']]);

    expect(lines).toEqual(['only', '----', 'a   ', 'bb  ']);
  });
});