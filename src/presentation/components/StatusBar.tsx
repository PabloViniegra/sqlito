import { Box, Text } from "ink";
import { memo } from "react";
import type { QueryOutcome } from "../../domain/sql/QueryOutcome.ts";
import type { Theme } from "../../domain/theme/Theme.ts";
import type { StatusMessage } from "../app/appReducer.ts";
import {
  layoutStatusBar,
  type StatusBarLayout,
  type StatusBarLayoutInput,
} from "./StatusBar/layoutStatusBar.ts";
import { Hint, OutcomeChip, StatusLine } from "./StatusBar/parts.tsx";

type Props = StatusBarLayoutInput & {
  theme: Theme;
  statusMessage: StatusMessage | null;
  compact?: boolean;
};

function StatusBarImpl(props: Props) {
  const {
    theme,
    statusMessage,
    historyCount,
    favoritesCount,
    lastOutcome,
    running = false,
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
        running={running}
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
  running: boolean;
};

function StatusSummary({
  layout,
  theme,
  historyCount,
  favoritesCount,
  lastOutcome,
  running,
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
          <Hint label="^C" token={running ? "cancel" : "quit"} theme={theme} />
        </Box>
      ) : null}
    </Box>
  );
}

export const StatusBar = memo(StatusBarImpl);
