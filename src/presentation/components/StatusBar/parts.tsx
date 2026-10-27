import { Box, Text } from "ink";
import stringWidth from "string-width";
import type { QueryOutcome } from "../../../domain/sql/QueryOutcome.ts";
import { outcomeTag } from "../../../domain/sql/outcomeTag.ts";
import type { Theme } from "../../../domain/theme/Theme.ts";
import { truncateCell } from "../../../shared/utils/formatCell.ts";
import type { StatusMessage } from "../../app/appReducer.ts";
import { renderOutcomeChip } from "../outcomeChip.ts";

export function Hint({
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

export function StatusLine({
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

export function OutcomeChip({
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
