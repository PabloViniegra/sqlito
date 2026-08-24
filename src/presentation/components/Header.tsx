import { Box, Text } from "ink";
import { memo } from "react";
import stringWidth from "string-width";
import type { Theme } from "../../domain/theme/Theme.ts";
import { truncateCell } from "../../shared/utils/formatCell.ts";
import { FULL_HEADER_MIN_COLUMNS } from "../layout/headerLayout.ts";
import { normalizeTerminalColumns } from "../layout/terminalDimensions.ts";

const MASCOT = [
  " ▄█▄   ▄█▄ ",
  "█████ █████",
  "█████ █████",
  " ▀█▀   ▀█▀ ",
].join("\n");

const MASCOT_WIDTH = Math.max(
  ...MASCOT.split("\n").map((line) => stringWidth(line)),
);

type Props = {
  dbPath: string;
  theme: Theme;
  columns?: number;
};

function HeaderImpl({ dbPath, theme, columns = 80 }: Props) {
  const terminalWidth = normalizeTerminalColumns(columns);
  if (terminalWidth < 6) {
    return (
      <Text color={theme.tokens.primary} bold>
        {truncateCell("SQLITO", terminalWidth)}
      </Text>
    );
  }
  if (terminalWidth < FULL_HEADER_MIN_COLUMNS) {
    return (
      <CompactHeader dbPath={dbPath} theme={theme} columns={terminalWidth} />
    );
  }

  const innerWidth = Math.max(1, terminalWidth - 4);
  const metaWidth = Math.max(1, innerWidth - MASCOT_WIDTH - 1);
  const fixedMetaWidth = stringWidth(`SQLITO ──  ── ${theme.name}`);
  const path = truncateCell(dbPath, Math.max(0, metaWidth - fixedMetaWidth));

  return (
    <Box
      width={terminalWidth}
      borderStyle="round"
      borderColor={theme.tokens.border}
      paddingX={1}
      alignItems="center"
      justifyContent="center"
      gap={1}
      overflowX="hidden"
    >
      <Text color={theme.tokens.accent}>{MASCOT}</Text>
      <Box width={metaWidth} flexShrink={1} overflowX="hidden">
        <Text color={theme.tokens.primary} bold>
          SQLITO
        </Text>
        <Text color={theme.tokens.muted}> ── </Text>
        <Text color={theme.tokens.dim}>{path}</Text>
        <Text color={theme.tokens.muted}> ── </Text>
        <Text color={theme.tokens.muted}>{theme.name}</Text>
      </Box>
    </Box>
  );
}

function CompactHeader({
  dbPath,
  theme,
  columns,
}: {
  dbPath: string;
  theme: Theme;
  columns: number;
}) {
  const innerWidth = Math.max(1, columns - 4);
  const wordmark = truncateCell("SQLITO", innerWidth);
  const suffix = ` · ${theme.name}`;
  const pathPrefix = " · ";
  const pathWidth = innerWidth - stringWidth(wordmark + pathPrefix + suffix);
  const path = truncateCell(dbPath, Math.max(0, pathWidth));
  const showPath = path !== "" && pathWidth > 0;
  const showTheme = stringWidth(wordmark + suffix) <= innerWidth;

  return (
    <Box
      width={columns}
      borderStyle="round"
      borderColor={theme.tokens.border}
      paddingX={1}
      overflowX="hidden"
    >
      <Text color={theme.tokens.primary} bold>
        {wordmark}
      </Text>
      {showPath ? (
        <>
          <Text color={theme.tokens.muted}>{pathPrefix}</Text>
          <Text color={theme.tokens.dim}>{path}</Text>
        </>
      ) : null}
      {showTheme ? <Text color={theme.tokens.muted}>{suffix}</Text> : null}
    </Box>
  );
}

export const Header = memo(HeaderImpl);
