import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';

describe('better-sqlite3 smoke', () => {
  it('opens an in-memory database and runs a query', () => {
    const db = new Database(':memory:');
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)');
    db.prepare('INSERT INTO users (name) VALUES (?)').run('Ada');

    const rows = db.prepare('SELECT name FROM users ORDER BY id').all();

    expect(rows).toEqual([{ name: 'Ada' }]);
    db.close();
  });
});
