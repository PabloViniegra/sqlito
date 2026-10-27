import { Command } from "commander";
import { render, type Instance } from "ink";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pkg from "../package.json" with { type: "json" };
import type { Database } from "./domain/database/Database.ts";
import type { SchemaRepository } from "./domain/schema/SchemaRepository.ts";
import { App } from "./presentation/app/App.tsx";
import { SqliteSchemaRepository } from "./infrastructure/sqlite/SqliteSchemaRepository.ts";
import { WorkerDatabase } from "./infrastructure/sqlite/WorkerDatabase.ts";

export type MountOptions = {
  stdin?: NodeJS.ReadStream;
  stdout?: NodeJS.WriteStream;
  patchConsole?: boolean;
  interactive?: boolean;
};

export function mountApp(
  handle: {
    db: Database;
    schema: SchemaRepository;
    dbPath: string;
  },
  options: MountOptions = {},
): Instance {
  // Ink 7 has no <FullScreen> component (public exports are Box, Text, Static,
  // Transform, Newline, Spacer only). The `alternateScreen` render option is
  // the canonical alternate-screen entry; it emits \x1b[?1049h on mount and
  // \x1b[?1049l + \x1b[?25h on unmount. PRD §Modules `useFullscreenApp.ts`
  // was authored against a non-existent API; this flag replaces it.
  return render(
    <App db={handle.db} schema={handle.schema} dbPath={handle.dbPath} />,
    {
      alternateScreen: true,
      // ^C must reach the app: it cancels a running query and quits otherwise
      exitOnCtrlC: false,
      ...(options.stdin !== undefined && { stdin: options.stdin }),
      ...(options.stdout !== undefined && { stdout: options.stdout }),
      ...(options.patchConsole !== undefined && {
        patchConsole: options.patchConsole,
      }),
      ...(options.interactive !== undefined && {
        interactive: options.interactive,
      }),
    },
  );
}

export function run(argv: readonly string[]): void {
  const program = new Command();
  program
    .name("sqlito")
    .version(pkg.version)
    .argument("<database>", "path to a SQLite database file")
    .option("--readonly", "open the database read-only")
    .action((databaseArg: string, options: { readonly?: boolean }) => {
      const dbPath = resolve(databaseArg);
      if (!existsSync(dbPath)) {
        process.stderr.write(`sqlito: cannot open database '${databaseArg}'\n`);
        process.exit(1);
      }
      const db = new WorkerDatabase(dbPath, {
        readonly: options.readonly === true,
      });
      const schema = new SqliteSchemaRepository(db);
      mountApp({ db, schema, dbPath });
    });

  program.parse(argv);
}
