import { Box, Text } from "ink";
import { memo } from "react";
import stringWidth from "string-width";
import type { Theme } from "../../domain/theme/Theme.ts";
import { truncateCell } from "../../shared/utils/formatCell.ts";
import { FULL_HEADER_MIN_COLUMNS } from "../layout/headerLayout.ts";
import { normalizeTerminalColumns } from "../layout/terminalDimensions.ts";
import { shouldAnimateIntro, useFrameTicker } from "../hooks/useFrameTicker.ts";
import { buildIntroSchedule } from "./Header/introSequence.ts";

const MASCOT_ROWS = [
  " ▄█▄   ▄█▄ ",
  "█████ █████",
  "█████ █████",
  " ▀█▀   ▀█▀ ",
];
const MASCOT = MASCOT_ROWS.join("\n");
const WORDMARK = "SQLITO";
const INTRO_SCHEDULE = buildIntroSchedule(MASCOT_ROWS.length, WORDMARK);
const INTRO_FRAMES = INTRO_SCHEDULE.frames;

const MASCOT_WIDTH = Math.max(...MASCOT_ROWS.map((line) => stringWidth(line)));

function mascotRowText(
  row: string,
  cell: "hidden" | "ghost" | "solid",
): string {
  if (cell === "solid") return row;
  const blank = row.replace(/\S/g, " ");
  return cell === "ghost" ? blank.replace(/ /g, "░") : blank;
}

type Props = {
  dbPath: string;
  theme: Theme;
  columns?: number;
};

function HeaderImpl({ dbPath, theme, columns = 80 }: Props) {
  const terminalWidth = normalizeTerminalColumns(columns);
  const animated =
    shouldAnimateIntro() && terminalWidth >= FULL_HEADER_MIN_COLUMNS;
  const step = useFrameTicker(
    INTRO_FRAMES.length,
    animated,
    INTRO_SCHEDULE.delays,
  );

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

  if (step >= INTRO_FRAMES.length) {
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

  const frame = INTRO_FRAMES[Math.min(step, INTRO_FRAMES.length - 1)]!;
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
      <Text color={theme.tokens.accent}>
        {MASCOT_ROWS.map((row, i) => mascotRowText(row, frame.mascot[i]!)).join(
          "\n",
        )}
      </Text>
      <Box width={metaWidth} flexShrink={1} overflowX="hidden">
        {frame.shimmer !== null ? (
          frame.wordmark.map((cell, i) => (
            <Text
              key={i}
              color={
                i === frame.shimmer ? theme.tokens.accent : theme.tokens.primary
              }
              bold
            >
              {cell.char}
            </Text>
          ))
        ) : (
          <Text color={theme.tokens.primary} bold>
            {frame.wordmark.map((cell) => cell.char).join("")}
          </Text>
        )}
        {frame.showMeta ? (
          <>
            <Text color={theme.tokens.muted}> ── </Text>
            <Text color={theme.tokens.dim}>{path}</Text>
            <Text color={theme.tokens.muted}> ── </Text>
            <Text color={theme.tokens.muted}>{theme.name}</Text>
          </>
        ) : null}
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
