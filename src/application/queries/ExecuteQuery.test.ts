import { afterEach, describe, expect, it } from 'vitest';
import { BetterSqliteDatabase } from '../../infrastructure/sqlite/BetterSqliteDatabase.ts';
import { ExecuteQuery } from './ExecuteQuery.ts';

describe('ExecuteQuery', () => {
  let db: BetterSqliteDatabase;
  let useCase: ExecuteQuery;

  afterEach(() => db?.close());

  const setup = (): ExecuteQuery => {
    db = new BetterSqliteDatabase(':memory:');
    useCase = new ExecuteQuery(db);
    return useCase;
  };

  it('executes SELECT and returns rows', () => {
    const exec = setup();

    const outcome = exec.execute('SELECT 1 AS a');

    expect(outcome.kind).toBe('rows');
    if (outcome.kind !== 'rows') throw new Error('expected rows');
    expect(outcome.columns).toEqual([{ name: 'a', type: null }]);
    expect(outcome.rows).toEqual([[1]]);
  });

  it('executes SELECT with multiple rows and preserves cell values', () => {
    const exec = setup();
    db.prepare('CREATE TABLE t (id INTEGER, name TEXT)').run();
    db.prepare("INSERT INTO t VALUES (1, 'Ada'), (2, 'Lin')").run();

    const outcome = exec.execute('SELECT id, name FROM t ORDER BY id');

    expect(outcome.kind).toBe('rows');
    if (outcome.kind !== 'rows') throw new Error('expected rows');
    expect(outcome.columns.map((c) => c.name)).toEqual(['id', 'name']);
    expect(outcome.rows).toEqual([
      [1, 'Ada'],
      [2, 'Lin'],
    ]);
  });

  it('returns empty rows when SELECT matches nothing', () => {
    const exec = setup();

    const outcome = exec.execute('SELECT 1 WHERE 0');

    expect(outcome.kind).toBe('rows');
    if (outcome.kind !== 'rows') throw new Error('expected rows');
    expect(outcome.rows).toEqual([]);
  });

  it('returns error outcome for invalid SQL', () => {
    const exec = setup();

    const outcome = exec.execute('SELECT FROM');

    expect(outcome.kind).toBe('error');
  });
});