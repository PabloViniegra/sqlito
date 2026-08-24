import { Box, Text } from "ink";
import { useReducer } from "react";
import type { Database } from "../../domain/database/Database.ts";
import type { SchemaRepository } from "../../domain/schema/SchemaRepository.ts";
import { AutocompletePopup } from "../components/AutocompletePopup.tsx";
import { CommandPalette } from "../components/CommandPalette.tsx";
import { Header } from "../components/Header.tsx";
import { Prompt } from "../components/Prompt.tsx";
import { ResultsTable } from "../components/ResultsTable.tsx";
import { StatusBar } from "../components/StatusBar.tsx";
import { useViewportSize } from "../hooks/useViewportSize.ts";
import { appReducer, initialState } from "./appReducer.ts";
import { useAppDeps } from "./useAppDeps.ts";
import { useAppKeybindings } from "./useAppKeybindings.ts";
import { useResultsLayout } from "./useResultsLayout.ts";

type Props = {
  db: Database;
  schema: SchemaRepository;
  dbPath: string;
};

export function App({ db, schema, dbPath }: Props) {
  const { rows, columns } = useViewportSize();
  const [state, dispatch] = useReducer(appReducer, initialState);
  const deps = useAppDeps({ db, schema, dispatch });
  useAppKeybindings({ deps, state, dispatch });
  const {
    prefix,
    suggestions,
    paletteMatches,
    autocompleteMaxLines,
    paletteMaxLines,
    statusMaxLines,
    compactStatus,
    headerVisible,
    statusVisible,
    promptVisible,
    resultsView,
  } = useResultsLayout({ state, deps, columns, rows });

  const popup = state.autocomplete;
  const palette = state.commandPalette;
  const expanded = resultsView.expanded;

  return (
    <Box flexDirection="column" height={rows}>
      {headerVisible ? (
        <Header dbPath={dbPath} theme={state.theme} columns={columns} />
      ) : null}
      <Box flexGrow={1} />
      {expanded !== null && (
        <Box
          flexDirection="column"
          flexShrink={1}
          overflowY="hidden"
          minHeight={0}
        >
          {resultsView.showIndicator ? (
            <Text color={state.theme.tokens.muted}>
              ↑ {resultsView.hiddenAbove} more · PgUp
            </Text>
          ) : null}
          {resultsView.collapsed.map((item) => (
            <ResultsTable
              key={item.id}
              outcome={item.outcome}
              sql={item.sql}
              theme={state.theme}
              columns={columns}
              variant="compact"
            />
          ))}
          <ResultsTable
            key={expanded.id}
            outcome={expanded.outcome}
            sql={expanded.sql}
            theme={state.theme}
            columns={columns}
            maxLines={resultsView.expandedMaxLines}
          />
        </Box>
      )}
      {popup !== null && autocompleteMaxLines > 0 && palette === null ? (
        <Box width={columns} flexDirection="column" overflowX="hidden">
          <AutocompletePopup
            suggestions={suggestions}
            index={popup.index}
            theme={state.theme}
            columns={columns}
            maxLines={autocompleteMaxLines}
          />
        </Box>
      ) : null}
      {palette !== null && paletteMaxLines > 0 ? (
        <CommandPalette
          commands={paletteMatches}
          query={palette.query}
          index={palette.index}
          theme={state.theme}
          columns={columns}
          maxLines={paletteMaxLines}
        />
      ) : null}
      {promptVisible ? (
        <Prompt
          readlineState={state.prompt}
          viewportColumns={columns}
          prefix={prefix}
          theme={state.theme}
        />
      ) : null}
      {statusVisible ? (
        <StatusBar
          dbPath={dbPath}
          theme={state.theme}
          statusMessage={state.statusMessage}
          historyCount={state.history.entries.length}
          favoritesCount={state.favorites.length}
          columns={columns}
          lastOutcome={state.lastOutcome}
          compact={compactStatus}
          maxLines={statusMaxLines}
        />
      ) : null}
    </Box>
  );
}
