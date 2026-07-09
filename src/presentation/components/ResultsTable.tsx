import { Box, Text } from "ink";
import { memo, type ReactNode } from "react";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { outcomeTag, type OutcomeTag } from "../../domain/sql/outcomeTag.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import {
  formatBorderedTable,
  type BorderedTable,
} from "../../shared/utils/formatBorderedTable.ts";
import { truncateCell } from "../../shared/utils/formatCell.ts";
import { formatPlanTree } from "../../shared/utils/formatPlanTree.ts";
import { wrapPrompt } from "../../shared/utils/wrapPrompt.ts";

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

function footerFor(outcome: QueryOutcome): string | null {
  if (outcome.kind === "side-effect") return "OK";
  if (outcome.kind === "rows" && outcome.rows.length > 0) return "OK";
  if (outcome.kind === "plan") return "OK";
  if (outcome.kind === "error") return null;
  return null;
}

type CardContent = {
  body: ReactNode;
  footer: { text: string; color: string } | null;
};

function buildCard(
  outcome: QueryOutcome,
  terminalWidth: number,
  theme: Theme,
  table: BorderedTable | null,
  bodyBudget: number,
  keyword: string,
): CardContent {
  switch (outcome.kind) {
    case "rows": {
      const lines = table === null ? [] : table.lines;
      const okFooter =
        outcome.writes === true
          ? `✓ ${keyword} OK · ${outcome.rows.length} rows returned`
          : footerFor(outcome);
      const needed = lines.length + (okFooter === null ? 0 : 1);
      if (needed <= bodyBudget) {
        return {
          body: renderTableLines(lines, theme),
          footer:
            okFooter === null
              ? null
              : { text: okFooter, color: theme.tokens.success },
        };
      }
      // clamp: table frame is 4 lines, plus one truncation footer
      const shownRows = Math.max(0, bodyBudget - 5);
      const hiddenRows = outcome.rows.length - shownRows;
      const clamped =
        bodyBudget >= 5
          ? [...lines.slice(0, 3 + shownRows), lines[lines.length - 1]!]
          : [];
      return {
        body: renderTableLines(clamped, theme),
        footer: {
          text:
            hiddenRows > 0
              ? `… +${hiddenRows} more rows (${outcome.rows.length} total)`
              : `${outcome.rows.length} rows`,
          color: theme.tokens.dim,
        },
      };
    }
    case "affected": {
      // lastInsertRowid is connection-level state in SQLite: stale (and
      // misleading) for anything that isn't an actual insert
      const inserts = keyword === "INSERT" || keyword === "REPLACE";
      const rowid =
        inserts && Number(outcome.lastInsertRowid) > 0
          ? ` · rowid ${outcome.lastInsertRowid.toString()}`
          : "";
      return {
        body: (
          <Text>
            <Text color={theme.tokens.success}>✓ {keyword} OK · </Text>
            <Text color={theme.tokens.writes} bold>
              {outcome.changes === 0
                ? "0 rows matched"
                : `${outcome.changes} rows`}
            </Text>
            {rowid === "" ? null : (
              <Text color={theme.tokens.success}>{rowid}</Text>
            )}
          </Text>
        ),
        footer: null,
      };
    }
    case "side-effect":
      return {
        body:
          bodyBudget >= 2 ? (
            <Text color={theme.tokens.muted} italic>
              done
            </Text>
          ) : null,
        footer: { text: "OK", color: theme.tokens.success },
      };
    case "plan": {
      const lines = formatPlanTree(outcome.nodes, terminalWidth);
      if (lines.length + 1 <= bodyBudget) {
        return {
          body: renderPlanLines(lines, theme),
          footer: { text: "OK", color: theme.tokens.success },
        };
      }
      const shown = Math.max(0, bodyBudget - 1);
      return {
        body: renderPlanLines(lines.slice(0, shown), theme),
        footer: {
          text: `… +${lines.length - shown} more nodes`,
          color: theme.tokens.dim,
        },
      };
    }
    case "error": {
      const hasCode =
        typeof outcome.code === "string" && outcome.code.length > 0;
      const gutterWidth = Math.max(1, terminalWidth - 2);
      const messageLines = outcome.message
        .split("\n")
        .flatMap(
          (segment) =>
            wrapPrompt({ text: segment, viewportColumns: gutterWidth }).rows,
        );
      const messageBudget = Math.max(1, bodyBudget - (hasCode ? 1 : 0));
      const showCode = hasCode && bodyBudget >= 2;
      const clipped = messageLines.length > messageBudget;
      const shown = clipped
        ? messageLines.slice(0, messageBudget)
        : messageLines;
      if (clipped) {
        const lastIdx = shown.length - 1;
        shown[lastIdx] = truncateCell(`${shown[lastIdx]!} …`, gutterWidth);
      }
      return {
        body: (
          <Box flexDirection="column">
            {showCode ? (
              <Box>
                <Text color={theme.tokens.muted}>! </Text>
                <Text color={theme.tokens.error}>{outcome.code}</Text>
              </Box>
            ) : null}
            {shown.map((line, i) => (
              <Box key={i}>
                <Text color={theme.tokens.muted}>! </Text>
                <Text color={theme.tokens.error}>{line}</Text>
              </Box>
            ))}
          </Box>
        ),
        footer: null,
      };
    }
  }
}

function renderTableLines(lines: readonly string[], theme: Theme): ReactNode {
  const last = lines.length - 1;
  return lines.map((line, i) => {
    const isHeader = i === 1;
    const isBorder = i === 0 || i === 2 || i === last;
    return (
      <Text
        key={i}
        color={
          isHeader
            ? theme.tokens.primary
            : isBorder
              ? theme.tokens.border
              : theme.tokens.dim
        }
        bold={isHeader}
      >
        {line}
      </Text>
    );
  });
}

function renderPlanLines(lines: readonly string[], theme: Theme): ReactNode {
  return lines.map((line, i) => (
    <Text key={i} color={theme.tokens.muted}>
      {line}
    </Text>
  ));
}

export const ResultsTable = memo(ResultsTableImpl);
