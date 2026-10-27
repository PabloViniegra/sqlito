import { Box, Text } from "ink";
import { memo } from "react";
import stringWidth from "string-width";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import { outcomeTag } from "../../domain/sql/outcomeTag.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import { truncateCell } from "../../shared/utils/formatCell.ts";
import type { StatusMessage } from "../app/appReducer.ts";
import {
  normalizeLayoutLines,
  normalizeTerminalColumns,
} from "../layout/terminalDimensions.ts";
import { renderOutcomeChip } from "./outcomeChip.ts";

type Props = {
  dbPath: string;
  theme: Theme;
  statusMessage: StatusMessage | null;
  historyCount: number;
  favoritesCount: number;
  columns: number;
  lastOutcome: QueryOutcome | null;
  compact?: boolean;
  maxLines?: number;
};

function StatusBarImpl(props: Props) {
  const {
    theme,
    statusMessage,
    historyCount,
    favoritesCount,
    lastOutcome,
    compact = false,
  } = props;
  const layout = layoutStatusBar(props);
  if (layout === null) return null;
  const { terminalWidth, visibleLines, horizontalPadding, contentWidth, rule } =
    layout;

  return (
    <Box
      width={terminalWidth}
      height={Number.isFinite(visibleLines) ? visibleLines : undefined}
      minHeight={0}
      flexDirection="column"
      overflowX="hidden"
      overflowY="hidden"
    >
      {compact ? null : <Text color={theme.tokens.muted}>{rule}</Text>}
      <StatusSummary
        layout={layout}
        theme={theme}
        historyCount={historyCount}
        favoritesCount={favoritesCount}
        lastOutcome={lastOutcome}
      />
      {!compact && statusMessage !== null ? (
        <Box
          width={terminalWidth}
          paddingX={horizontalPadding}
          overflowX="hidden"
        >
          <StatusLine
            message={statusMessage}
            theme={theme}
            maxWidth={terminalWidth < 4 ? contentWidth : undefined}
          />
        </Box>
      ) : null}
    </Box>
  );
}

type StatusSummaryProps = {
  layout: StatusBarLayout;
  theme: Theme;
  historyCount: number;
  favoritesCount: number;
  lastOutcome: QueryOutcome | null;
};

function StatusSummary({
  layout,
  theme,
  historyCount,
  favoritesCount,
  lastOutcome,
}: StatusSummaryProps) {
  return (
    <Box
      width={layout.terminalWidth}
      paddingX={layout.horizontalPadding}
      overflowX="hidden"
    >
      {layout.showPath ? (
        <Box flexShrink={0}>
          <Text color={theme.tokens.success}>● </Text>
          <Text color={theme.tokens.dim}>{layout.path}</Text>
        </Box>
      ) : null}
      {layout.showCounters ? (
        <Box flexShrink={0}>
          <Text color={theme.tokens.muted}>{layout.showPath ? " · " : ""}</Text>
          <Text color={theme.tokens.muted}>
            {`${historyCount} history · ${favoritesCount} favorites`}
          </Text>
        </Box>
      ) : null}
      {lastOutcome !== null ? (
        <Box flexShrink={0}>
          <Text color={theme.tokens.muted}>
            {layout.showPath || layout.showCounters ? " · " : ""}
          </Text>
          <OutcomeChip
            outcome={lastOutcome}
            theme={theme}
            display={{
              tag: layout.displayOutcomeTag,
              detail: layout.outcomeDetail,
            }}
          />
        </Box>
      ) : null}
      <Box flexGrow={1} />
      {layout.showHints ? (
        <Box flexShrink={0}>
          <Text color={theme.tokens.muted}>
            {layout.showPath || layout.showCounters || lastOutcome !== null
              ? " · "
              : ""}
          </Text>
          <Hint label="^R" token="search" theme={theme} />
          <Hint label="^P" token="palette" theme={theme} />
          <Hint label="^C" token="quit" theme={theme} />
        </Box>
      ) : null}
    </Box>
  );
}

type StatusBarLayout = {
  terminalWidth: number;
  visibleLines: number;
  horizontalPadding: number;
  contentWidth: number;
  rule: string;
  showPath: boolean;
  showCounters: boolean;
  showHints: boolean;
  displayOutcomeTag: string;
  outcomeDetail: string;
  path: string;
};

function layoutStatusBar({
  dbPath,
  historyCount,
  favoritesCount,
  columns,
  lastOutcome,
  maxLines = Number.POSITIVE_INFINITY,
}: Props): StatusBarLayout | null {
  const terminalWidth = normalizeTerminalColumns(columns);
  const visibleLines = normalizeLayoutLines(maxLines);
  if (visibleLines <= 0) return null;
  const horizontalPadding = terminalWidth >= 3 ? 1 : 0;
  const contentWidth = Math.max(1, terminalWidth - horizontalPadding * 2);
  const rule = "─".repeat(terminalWidth);
  const counterText = `${historyCount} history · ${favoritesCount} favorites`;
  const hintsText = "^R search · ^P palette · ^C quit";
  const outcome = lastOutcome === null ? null : renderOutcomeChip(lastOutcome);
  let showPath = true;
  let showHints = contentWidth >= 60;
  let showCounters = contentWidth >= 40;
  const outcomeTagWidth = outcome === null ? 0 : stringWidth(outcome.tag);
  const outcomeFullDetailWidth =
    outcome === null ? 0 : stringWidth(outcome.detail);
  const suffixWidth = (
    detailWidth: number,
    tagWidth = outcomeTagWidth,
  ): number => {
    let width = 0;
    if (showCounters) {
      width += (showPath ? 3 : 0) + stringWidth(counterText);
    }
    if (outcome !== null) {
      width += (showPath || showCounters ? 3 : 0) + tagWidth;
      width += detailWidth === 0 ? 0 : 1 + detailWidth;
    }
    if (showHints) {
      width +=
        (showPath || showCounters || outcome !== null ? 3 : 0) +
        stringWidth(hintsText);
    }
    return width;
  };
  while (
    (showPath ? 3 : 0) + suffixWidth(outcomeFullDetailWidth) >
    contentWidth
  ) {
    if (showHints) {
      showHints = false;
      continue;
    }
    if (showCounters) {
      showCounters = false;
      continue;
    }
    if (showPath) {
      showPath = false;
      continue;
    }
    break;
  }
  const detailReserve = outcome !== null && outcome.detail !== "" ? 1 : 0;
  const maxOutcomeWidth = Math.max(
    0,
    contentWidth - (showPath ? 3 : 0) - suffixWidth(0) - detailReserve,
  );
  const outcomeTagLimit =
    outcome === null
      ? 0
      : Math.max(
          1,
          contentWidth -
            (showPath ? 3 : 0) -
            (showCounters ? (showPath ? 3 : 0) + stringWidth(counterText) : 0) -
            (showHints
              ? (showPath || showCounters ? 3 : 0) + stringWidth(hintsText)
              : 0) -
            (showPath || showCounters ? 3 : 0),
        );
  const displayOutcomeTag =
    outcome === null ? "" : truncateCell(outcome.tag, outcomeTagLimit);
  const outcomeDetail =
    outcome === null
      ? ""
      : truncateCell(outcome.detail, Math.max(0, maxOutcomeWidth));
  const path = truncateCell(
    dbPath,
    Math.max(
      1,
      contentWidth -
        2 -
        suffixWidth(stringWidth(outcomeDetail), stringWidth(displayOutcomeTag)),
    ),
  );

  return {
    terminalWidth,
    visibleLines,
    horizontalPadding,
    contentWidth,
    rule,
    showPath,
    showCounters,
    showHints,
    displayOutcomeTag,
    outcomeDetail,
    path,
  };
}

function Hint({
  label,
  token,
  theme,
}: {
  label: string;
  token: string;
  theme: Theme;
}) {
  return (
    <Box flexShrink={0}>
      <Text>
        <Text color={theme.tokens.primary} bold>
          {label}
        </Text>
        <Text color={theme.tokens.muted}> {token} </Text>
      </Text>
    </Box>
  );
}

function StatusLine({
  message,
  theme,
  maxWidth,
}: {
  message: StatusMessage;
  theme: Theme;
  maxWidth?: number;
}) {
  const prefix = message.kind === "error" ? "! " : "";
  const shownPrefix =
    maxWidth === undefined ? prefix : truncateCell(prefix, maxWidth);
  const shownText =
    maxWidth === undefined
      ? message.text
      : truncateCell(message.text, Math.max(0, maxWidth - stringWidth(prefix)));
  if (message.kind === "error") {
    return (
      <Text>
        <Text color={theme.tokens.muted}>{shownPrefix}</Text>
        <Text color={theme.tokens.error}>{shownText}</Text>
      </Text>
    );
  }
  return <Text color={theme.tokens.muted}>{shownText}</Text>;
}

function OutcomeChip({
  outcome,
  theme,
  display,
}: {
  outcome: QueryOutcome;
  theme: Theme;
  display?: { tag: string; detail: string };
}) {
  const { tag, detail } = renderOutcomeChip(outcome);
  const shownTag = display?.tag ?? tag;
  const shownDetail = display?.detail ?? detail;
  const kind = outcomeTag(outcome);
  const tagColor =
    kind === "WRITE"
      ? theme.tokens.writes
      : kind === "ERROR"
        ? theme.tokens.error
        : theme.tokens.success;
  return (
    <Text>
      <Text color={tagColor} bold>
        {shownTag}
      </Text>
      {shownDetail !== "" && (
        <Text color={theme.tokens.muted}> {shownDetail}</Text>
      )}
    </Text>
  );
}

export const StatusBar = memo(StatusBarImpl);
