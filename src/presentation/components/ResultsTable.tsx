import { Box, Text } from "ink";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { formatBorderedTable } from "../../shared/utils/formatBorderedTable.ts";
import { formatPlanTree } from "../../shared/utils/formatPlanTree.ts";
import { useViewportSize } from "../hooks/useViewportSize.ts";

type Props = { outcome: QueryOutcome; sql: string; theme: Theme };

export function ResultsTable({ outcome, sql, theme }: Props) {
  const { columns: terminalWidth } = useViewportSize();
  const rule = "─".repeat(terminalWidth);
  const kind = classify(sql, outcome);
  const metadata = metadataFor(outcome);
  const sqlLabel = truncateSql(sql, sqlBudget(terminalWidth, kind, metadata));
  const footerText = footerFor(outcome);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={theme.tokens.primary}>▎ </Text>
        <Text color={theme.tokens.primary}>{kind}</Text>
        <Text color={theme.tokens.muted}> · {metadata}</Text>
        {sqlLabel === "" ? null : (
          <Text color={theme.tokens.dim}> · {sqlLabel}</Text>
        )}
      </Box>
      <Text color={theme.tokens.muted}>{rule}</Text>
      {renderBody(outcome, terminalWidth, theme)}
      {footerText === null ? null : (
        <Box marginTop={1}>
          <Text color={theme.tokens.success}>▎ </Text>
          <Text color={theme.tokens.success}>{footerText}</Text>
        </Box>
      )}
      <Text color={theme.tokens.muted}>{rule}</Text>
    </Box>
  );
}

function sqlBudget(
  terminalWidth: number,
  kind: string,
  metadata: string,
): number {
  const fixedBeforeSql = `▎ ${kind} · ${metadata} · `;
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
  if (outcome.kind === "affected" && Number(outcome.lastInsertRowid) > 0) {
    return `OK · last insert rowid: ${outcome.lastInsertRowid.toString()}`;
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
    case "rows":
      return formatBorderedTable(
        outcome.columns,
        outcome.rows,
        terminalWidth,
      ).map((line, i) => (
        <Text
          key={i}
          color={i === 1 ? theme.tokens.primary : undefined}
          bold={i === 1}
        >
          {line}
        </Text>
      ));
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
