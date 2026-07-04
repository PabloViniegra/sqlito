import { Command } from 'commander';
import { render } from 'ink';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from './presentation/app/App.tsx';
import { BetterSqliteDatabase } from './infrastructure/sqlite/BetterSqliteDatabase.ts';

export function run(argv: readonly string[]): void {
  const program = new Command();
  program
    .name('sqlito')
    .argument('<database>', 'path to a SQLite database file')
    .action((databaseArg: string) => {
      const dbPath = resolve(databaseArg);
      if (!existsSync(dbPath)) {
        process.stderr.write(`sqlito: cannot open database '${databaseArg}'\n`);
        process.exit(1);
      }
      const db = new BetterSqliteDatabase(dbPath);
      render(<App db={db} dbPath={dbPath} />);
    });

  program.parse(argv);
}