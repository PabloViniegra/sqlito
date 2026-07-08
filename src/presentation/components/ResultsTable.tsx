import { Box, Text } from "ink";
import { memo } from "react";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { outcomeTag, type OutcomeTag } from "../../domain/sql/outcomeTag.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { formatBorderedTable } from "../../shared/utils/formatBorderedTable.ts";
import { formatPlanTree } from "../../shared/utils/formatPlanTree.ts";

type Props = {
  outcome: QueryOutcome;
  sql: string;
  theme: Theme;
  columns: number;
};

function ResultsTableImpl({
  outcome,
  sql,
  theme,
  columns: terminalWidth,
}: Props) {
  const rule = "─".repeat(terminalWidth);
  const tag = outcomeTag(outcome);
  const kind = classify(sql, outcome);
  const metadata = metadataFor(outcome);
  const keyword = tag === "ERROR" || tag === "PLAN" ? null : kind;
  const sqlLabel = truncateSql(
    sql,
    sqlBudget(terminalWidth, tag, keyword, metadata),
  );
  const footerText = footerFor(outcome);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
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
      <Text color={theme.tokens.border}>{rule}</Text>
      {renderBody(outcome, terminalWidth, theme)}
      {footerText === null ? null : (
        <Box marginTop={1}>
          <Text color={theme.tokens.success}>▎ </Text>
          <Text color={theme.tokens.success}>{footerText}</Text>
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
  return Math.max(8, terminalWidth - fixedBeforeSql.length);
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
  if (outcome.kind === "affected") {
    const rowidFooter =
      Number(outcome.lastInsertRowid) > 0
        ? `last insert rowid: ${outcome.lastInsertRowid.toString()}`
        : null;
    if (outcome.changes === 0) {
      return rowidFooter === null
        ? "OK · no rows matched"
        : `OK · no rows matched · ${rowidFooter}`;
    }
    return rowidFooter === null ? null : `OK · ${rowidFooter}`;
  }
  if (outcome.kind === "side-effect") return "OK";
  if (outcome.kind === "rows" && outcome.rows.length > 0) return "OK";
  if (outcome.kind === "plan") return "OK";
  if (outcome.kind === "error") return null;
  return null;
}

function renderBody(
  outcome: QueryOutcome,
  terminalWidth: number,
  theme: Theme,
) {
  switch (outcome.kind) {
    case "rows": {
      const lines = formatBorderedTable(
        outcome.columns,
        outcome.rows,
        terminalWidth,
      );
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
    case "affected":
      return null;
    case "side-effect":
      return (
        <Box marginTop={1}>
          <Text color={theme.tokens.muted} italic>
            done
          </Text>
        </Box>
      );
    case "plan":
      return formatPlanTree(outcome.nodes, terminalWidth).map((line, i) => (
        <Text key={i} color={theme.tokens.muted}>
          {line}
        </Text>
      ));
    case "error":
      return (
        <Box marginTop={1}>
          <Text color={theme.tokens.muted}>! </Text>
          <Text color={theme.tokens.error}>{outcome.message}</Text>
        </Box>
      );
  }
}

export const ResultsTable = memo(ResultsTableImpl);
