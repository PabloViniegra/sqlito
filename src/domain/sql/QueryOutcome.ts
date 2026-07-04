import type { Column } from './Column.ts';

export type QueryOutcome =
  | { kind: 'rows'; columns: readonly Column[]; rows: readonly unknown[][] }
  | { kind: 'affected'; changes: number; lastInsertRowid: number | bigint }
  | { kind: 'error'; code?: string; message: string };