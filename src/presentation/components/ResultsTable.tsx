import { Box, Text } from "ink";
import { memo } from "react";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { outcomeTag, type OutcomeTag } from "../../domain/sql/outcomeTag.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { formatBorderedTable } from "../../shared/utils/formatBorderedTable.ts";
import { buildCard } from "./ResultsTable/card.tsx";

type Props = {
  outcome: QueryOutcome;
  sql: string;
  theme: Theme;
  columns: number;
  /** hard cap on rendered lines; the body clamps itself to honor it */
  maxLines?: number;
  /** compact renders only the one-line header */
  variant?: "full" | "compact";
};

// full-card chrome outside the body: header line + two rules
const CARD_CHROME = 3;
const MIN_FULL_CARD_LINES = 4;

function ResultsTableImpl({
  outcome,
  sql,
  theme,
  columns: terminalWidth,
  maxLines,
  variant = "full",
}: Props) {
  const tag = outcomeTag(outcome);
  const kind = classify(sql, outcome);
  const table =
    outcome.kind === "rows"
      ? formatBorderedTable(outcome.columns, outcome.rows, terminalWidth)
      : null;
  const metadata =
    table !== null && table.hiddenColumns > 0
      ? `${metadataFor(outcome)} · +${table.hiddenColumns} more cols`
      : metadataFor(outcome);
  const keyword = tag === "ERROR" || tag === "PLAN" ? null : kind;
  const sqlLabel = truncateSql(
    sql,
    sqlBudget(terminalWidth, tag, keyword, metadata),
  );

  const header = (
    <Box height={1} overflowY="hidden">
      <Text color={theme.tokens.primary}>▎ </Text>
      <Text color={tagColor(theme, tag)}>{tag}</Text>
      {keyword === null ? null : (
        <Text color={theme.tokens.primary}> {keyword}</Text>
      )}
      <Text color={theme.tokens.muted}> · {metadata}</Text>
      {sqlLabel === "" ? null : (
        <Text color={theme.tokens.dim}> · {sqlLabel}</Text>
      )}
    </Box>
  );

  const budget = maxLines ?? Number.POSITIVE_INFINITY;
  if (variant === "compact" || budget < MIN_FULL_CARD_LINES) return header;

  const rule = "─".repeat(terminalWidth);
  const card = buildCard(
    outcome,
    terminalWidth,
    theme,
    table,
    budget - CARD_CHROME,
    kind,
  );

  return (
    <Box flexDirection="column">
      {header}
      <Text color={theme.tokens.border}>{rule}</Text>
      {card.body}
      {card.footer === null ? null : (
        <Box>
          <Text color={card.footer.color}>▎ </Text>
          <Text color={card.footer.color}>{card.footer.text}</Text>
        </Box>
      )}
      <Text color={theme.tokens.border}>{rule}</Text>
    </Box>
  );
}

function tagColor(theme: Theme, tag: OutcomeTag): string {
  switch (tag) {
    case "READ":
      return theme.tokens.success;
    case "WRITE":
      return theme.tokens.writes;
    case "DDL":
      return theme.tokens.success;
    case "ERROR":
      return theme.tokens.error;
    case "PLAN":
      return theme.tokens.primary;
  }
}

function sqlBudget(
  terminalWidth: number,
  tag: OutcomeTag,
  keyword: string | null,
  metadata: string,
): number {
  const fixedBeforeSql = `▎ ${tag}${keyword === null ? "" : ` ${keyword}`} · ${metadata} · `;
  return Math.max(0, terminalWidth - fixedBeforeSql.length);
}

function truncateSql(sql: string, max: number): string {
  if (max <= 0) return "";
  if (sql.length <= max) return sql;
  if (max <= 1) return "…";
  return `${sql.slice(0, max - 1)}…`;
}

function classify(sql: string, outcome: QueryOutcome): string {
  if (outcome.kind === "error") return "ERROR";
  if (outcome.kind === "plan") return "PLAN";
  const trimmed = sql.trim();
  if (trimmed.startsWith(".")) {
    return trimmed.split(/\s+/)[0]!.slice(1).toUpperCase() || "COMMAND";
  }
  const firstWord = trimmed.split(/\s+/)[0]?.toLowerCase();
  if (firstWord === undefined || firstWord === "") return "QUERY";
  return firstWord.toUpperCase();
}

function metadataFor(outcome: QueryOutcome): string {
  switch (outcome.kind) {
    case "rows":
      return `${outcome.rows.length} rows`;
    case "affected":
      return `${outcome.changes} rows affected`;
    case "side-effect":
      return "side effect";
    case "plan":
      return `${outcome.nodes.length} node${outcome.nodes.length === 1 ? "" : "s"}`;
    case "error":
      return "aborted";
  }
}

export const ResultsTable = memo(ResultsTableImpl);
