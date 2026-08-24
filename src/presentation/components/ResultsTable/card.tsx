import { Box, Text } from "ink";
import type { ReactNode } from "react";
import type { QueryOutcome } from "../../../domain/sql/QueryOutcome.ts";
import type { Theme } from "../../../domain/theme/Theme.ts";
import type { BorderedTable } from "../../../shared/utils/formatBorderedTable.ts";
import { truncateCell } from "../../../shared/utils/formatCell.ts";
import { formatPlanTree } from "../../../shared/utils/formatPlanTree.ts";
import { wrapPrompt } from "../../../shared/utils/wrapPrompt.ts";

export type CardContent = {
  body: ReactNode;
  footer: { text: string; color: string } | null;
};

export function buildCard(
  outcome: QueryOutcome,
  terminalWidth: number,
  theme: Theme,
  table: BorderedTable | null,
  bodyBudget: number,
  keyword: string,
): CardContent {
  switch (outcome.kind) {
    case "rows":
      return buildRowsCard(outcome, table, bodyBudget, keyword, theme);
    case "affected":
      return buildAffectedCard(outcome, keyword, theme);
    case "side-effect":
      return buildSideEffectCard(bodyBudget, theme);
    case "plan":
      return buildPlanCard(outcome, terminalWidth, bodyBudget, theme);
    case "error":
      return buildErrorCard(outcome, terminalWidth, bodyBudget, theme);
  }
}

function buildRowsCard(
  outcome: Extract<QueryOutcome, { kind: "rows" }>,
  table: BorderedTable | null,
  bodyBudget: number,
  keyword: string,
  theme: Theme,
): CardContent {
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

function buildAffectedCard(
  outcome: Extract<QueryOutcome, { kind: "affected" }>,
  keyword: string,
  theme: Theme,
): CardContent {
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

function buildSideEffectCard(bodyBudget: number, theme: Theme): CardContent {
  return {
    body:
      bodyBudget >= 2 ? (
        <Text color={theme.tokens.muted} italic>
          done
        </Text>
      ) : null,
    footer: { text: "OK", color: theme.tokens.success },
  };
}

function buildPlanCard(
  outcome: Extract<QueryOutcome, { kind: "plan" }>,
  terminalWidth: number,
  bodyBudget: number,
  theme: Theme,
): CardContent {
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

function buildErrorCard(
  outcome: Extract<QueryOutcome, { kind: "error" }>,
  terminalWidth: number,
  bodyBudget: number,
  theme: Theme,
): CardContent {
  const hasCode = typeof outcome.code === "string" && outcome.code.length > 0;
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
  const shown = clipped ? messageLines.slice(0, messageBudget) : messageLines;
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

function footerFor(outcome: QueryOutcome): string | null {
  if (outcome.kind === "side-effect") return "OK";
  if (outcome.kind === "rows" && outcome.rows.length > 0) return "OK";
  if (outcome.kind === "plan") return "OK";
  if (outcome.kind === "error") return null;
  return null;
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
