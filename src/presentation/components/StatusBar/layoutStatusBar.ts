import stringWidth from "string-width";
import type { QueryOutcome } from "../../../domain/sql/QueryOutcome.ts";
import { truncateCell } from "../../../shared/utils/formatCell.ts";
import {
  normalizeLayoutLines,
  normalizeTerminalColumns,
} from "../../layout/terminalDimensions.ts";
import { renderOutcomeChip } from "../outcomeChip.ts";

export type StatusBarLayoutInput = {
  dbPath: string;
  historyCount: number;
  favoritesCount: number;
  columns: number;
  lastOutcome: QueryOutcome | null;
  running?: boolean;
  maxLines?: number;
};

export type StatusBarLayout = {
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

export function layoutStatusBar({
  dbPath,
  historyCount,
  favoritesCount,
  columns,
  lastOutcome,
  running = false,
  maxLines = Number.POSITIVE_INFINITY,
}: StatusBarLayoutInput): StatusBarLayout | null {
  const terminalWidth = normalizeTerminalColumns(columns);
  const visibleLines = normalizeLayoutLines(maxLines);
  if (visibleLines <= 0) return null;
  const horizontalPadding = terminalWidth >= 3 ? 1 : 0;
  const contentWidth = Math.max(1, terminalWidth - horizontalPadding * 2);
  const rule = "─".repeat(terminalWidth);
  const counterText = `${historyCount} history · ${favoritesCount} favorites`;
  const hintsText = `^R search · ^P palette · ^C ${running ? "cancel" : "quit"}`;
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
