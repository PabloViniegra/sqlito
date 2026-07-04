import { describe, expect, it } from 'vitest';
import { isReadOnly } from './isReadOnly.ts';

describe('isReadOnly', () => {
  it.each([
    ['SELECT 1', true],
    ['select 1', true],
    ['  SELECT * FROM users', true],
    ['WITH cte AS (SELECT 1) SELECT * FROM cte', true],
    ['PRAGMA table_info(users)', true],
    ['EXPLAIN SELECT * FROM users', true],
    ['explain query plan select 1', true],
    ['-- comment\nSELECT 1', true],
    ['/* hi */ SELECT 1', true],
    ['INSERT INTO users VALUES (1)', false],
    ['UPDATE users SET name = "x"', false],
    ['DELETE FROM users', false],
    ['CREATE TABLE t (a INT)', false],
    ['DROP TABLE t', false],
    ['ALTER TABLE t ADD COLUMN x INT', false],
    ['REPLACE INTO users VALUES (1)', false],
    ['', false],
  ])('classifies %j as %s', (sql, expected) => {
    expect(isReadOnly(sql)).toBe(expected);
  });
});