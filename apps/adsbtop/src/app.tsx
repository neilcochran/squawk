import { Box, useApp, useInput } from 'ink';
import type { Key } from 'ink';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { AircraftFeed } from '@squawk/adsb-feed';
import type { Aircraft, Coordinates } from '@squawk/types';

import type { FeedSource } from './cli-args.js';
import {
  autoFitColumns,
  availableColumns,
  minimalColumnKeys,
  nextSortKey,
  selectColumns,
  sortAircraft,
  sortKeyCycle,
  TABLE_CHROME_WIDTH,
  tableRowWidth,
  unavailableColumns,
} from './columns.js';
import type { ColumnKey, SortDirection, SortKey } from './columns.js';
import { AircraftTable } from './components/aircraft-table.js';
import { ColumnPicker } from './components/column-picker.js';
import { DetailView } from './components/detail-view.js';
import { FilterBar } from './components/filter-bar.js';
import { HelpOverlay } from './components/help-overlay.js';
import { HotkeyBar } from './components/hotkey-bar.js';
import { MessagesPanel } from './components/messages-panel.js';
import type { MessageVerbosity } from './components/messages-panel.js';
import { SearchBar } from './components/search-bar.js';
import { StatsPanel } from './components/stats-panel.js';
import { StatusHeader } from './components/status-header.js';
import type { StatusNotice } from './components/status-header.js';
import { filterAircraft, parseFilter } from './filter.js';
import type { AircraftFilter } from './filter.js';
import { createEventRecorder, openRecordSink } from './recorder.js';
import type { RecordSink } from './recorder.js';
import { enrichAircraftList } from './registration-cache.js';
import type { RegistrationCache } from './registration-cache.js';
import { findMatchIcaoHex } from './search.js';
import { moveSelection } from './selection.js';
import { buildSnapshotCsv, snapshotFileName, writeSnapshotFile } from './snapshot.js';
import { toggleUnitSystem } from './units.js';
import type { UnitSystem } from './units.js';
import { useAircraftFeed } from './use-aircraft-feed.js';
import { ringTerminalBell, useAlerts } from './use-alerts.js';
import { useIcaoRegistry } from './use-icao-registry.js';
import type { RegistryDataLoader } from './use-icao-registry.js';
import { useTerminalWidth } from './use-terminal-width.js';
import { matchesWatchlist } from './watchlist.js';

/** How often the age column and status-header "last update" text refresh. */
const CLOCK_TICK_MS = 1000;
/** Sort key adsbtop starts with. */
const INITIAL_SORT_KEY: SortKey = 'icaoHex';
/** Sort direction adsbtop starts with. */
const INITIAL_SORT_DIRECTION: SortDirection = 'asc';
/** How long a status-bar notice (snapshot saved, record failed) stays up. */
const NOTICE_MS = 5000;

/** Which content fills the main area below the status header. */
type Panel = 'table' | 'help' | 'detail' | 'columns';

/** Props for {@link App}. */
export interface AppProps {
  /** The live feed to subscribe to - already constructed for the CLI's selected source. */
  feed: AircraftFeed;
  /** Feed source in use, for the status header. */
  source: FeedSource;
  /** Station host, for the status header. */
  host: string;
  /** Station port, for the status header. */
  port: number;
  /** Loader for the bundled registry dataset used for registration enrichment. Defaults to a real dynamic import of `@squawk/icao-registry-data`; overridable in tests. */
  registryDataLoader?: RegistryDataLoader;
  /** Configured receiver location (`--lat`/`--lon`), if any. Makes the table's Dist/Brg/CPA columns available when set. */
  location: Coordinates | undefined;
  /** Columns requested with `--columns`, if any. Undefined means auto-fit the available columns to the terminal width until the user picks a set with `[C]`. */
  columnKeys: readonly ColumnKey[] | undefined;
  /** Filter to start with (`-f`/`--filter`), if any. The `[F]` prompt and Escape edit or clear it like one entered in-app. */
  filter: AircraftFilter | undefined;
  /** The feed's stale threshold (`--stale-after`), which the table dims rows against - see `isStaleRow`. */
  staleAfterMs: number;
  /** Normalized `--watch` terms; empty for no watchlist. Matching rows render highlighted and ring the bell on appearance and loss. */
  watchlist: readonly string[];
  /** Whether an aircraft first becoming an emergency rings the bell (`--alert-emergency`). */
  alertEmergency: boolean;
  /** Whether the bell may ring at all (false under `--no-bell`). */
  bell: boolean;
  /** Rings the terminal bell. Defaults to writing BEL to stdout; overridable in tests. */
  ring?: () => void;
  /** File to append every feed event to as JSON lines (`--record`), or undefined for no recording. */
  recordPath: string | undefined;
  /** Writes a `[W]` snapshot file. Defaults to writing into the working directory; overridable in tests. */
  writeSnapshot?: (fileName: string, contents: string) => Promise<void>;
  /** Opens the `--record` sink. Defaults to appending to the file; overridable in tests. */
  openRecordSink?: (path: string, onError: (error: Error) => void) => RecordSink;
  /** The unit system to start in (`--units`); `[U]` toggles it while running. */
  units: UnitSystem;
}

/**
 * adsbtop's root component: subscribes to the feed, owns display state
 * (pause, visible columns, units, sort key and direction, cursor, search, filter,
 * messages, stats, status-bar visibility, and which main panel is showing), wires the hotkey
 * bar, and renders the optional status header, main panel, optional messages
 * panel, optional search prompt, and hotkey bar.
 *
 * `[P]ause` freezes the table's displayed rows (the feed keeps running
 * underneath - resuming immediately jumps to current state, doesn't replay
 * what was missed). Implemented as a React "adjust state during render"
 * pattern (comparing the live feed's aircraft-array reference against what's
 * displayed, copying over only while not paused), not a `useEffect`, since
 * an effect-based version of this exact pattern trips
 * `react-hooks/set-state-in-effect` and cascades an extra render. The cursor
 * row's auto-selection and the sort key's reset when its column is hidden
 * use the same render-time-adjustment pattern for the same reason.
 *
 * Visible columns come from one of two sources: an explicit key list (from
 * `--columns` at startup, or the `[C]` picker once running), or, when there
 * is none, auto-fit against the live terminal width. Picking any column in
 * the picker switches to an explicit list seeded from what was showing;
 * `[F]` in the picker returns to auto-fit.
 *
 * `[W]` writes the filtered, sorted rows and visible columns to a CSV and
 * reports the outcome as a status-bar notice for {@link NOTICE_MS}; a
 * `--record` file is fed by an event recorder for the app's lifetime, with
 * write failures reported the same way, since writing to the terminal
 * would corrupt Ink's output.
 *
 * The `[F]ilter` narrows the sorted rows before anything else sees them:
 * the cursor, search, next-match, and the detail view all operate on the
 * filtered list, so a hidden aircraft can never be selected or opened.
 * Watchlist alerts deliberately do not go through the filter - they diff
 * the live, unfiltered aircraft list, since the bell is about what is
 * tracked rather than what is shown - and the status bar's `watch` segment
 * reports how many watched aircraft the filter is currently hiding.
 *
 * @param props - The feed to display, its connection details, and startup column configuration.
 */
export function App(props: AppProps): ReactElement {
  const { exit } = useApp();
  const view = useAircraftFeed(props.feed, props.location);
  const registry = useIcaoRegistry(props.registryDataLoader);
  const terminalWidth = useTerminalWidth();
  const [registrationCache] = useState<RegistrationCache>(() => new Map());
  const enrichedAircraft = useMemo(
    () => enrichAircraftList(view.aircraft, registry, registrationCache),
    [view.aircraft, registry, registrationCache],
  );

  const [paused, setPaused] = useState(false);
  const [columnKeys, setColumnKeys] = useState<readonly ColumnKey[] | undefined>(props.columnKeys);
  const [pickerIndex, setPickerIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>('table');
  const [sortKey, setSortKey] = useState<SortKey>(INITIAL_SORT_KEY);
  const [sortDirection, setSortDirection] = useState<SortDirection>(INITIAL_SORT_DIRECTION);
  const [showStatus, setShowStatus] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>(enrichedAircraft);
  const [selectedIcaoHex, setSelectedIcaoHex] = useState<string | undefined>(undefined);
  const [showMessages, setShowMessages] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [messageVerbosity, setMessageVerbosity] = useState<MessageVerbosity>('newAndLost');
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState<string | undefined>(undefined);
  const [filtering, setFiltering] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [filterError, setFilterError] = useState<string | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<AircraftFilter | undefined>(props.filter);
  const [notice, setNotice] = useState<(StatusNotice & { at: number }) | undefined>(undefined);
  const [units, setUnits] = useState<UnitSystem>(props.units);

  const { recordPath, openRecordSink: openSink = openRecordSink } = props;
  useEffect(() => {
    if (recordPath === undefined) {
      return undefined;
    }
    const sink = openSink(recordPath, (error) => {
      setNotice({ text: `record failed: ${error.message}`, kind: 'error', at: Date.now() });
    });
    const recorder = createEventRecorder(props.feed, sink);
    return () => {
      recorder.stop();
    };
  }, [props.feed, recordPath, openSink]);

  useAlerts({
    aircraft: enrichedAircraft,
    watchlist: props.watchlist,
    alertEmergency: props.alertEmergency,
    enabled: props.bell && !paused,
    ring: props.ring ?? ringTerminalBell,
  });

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(handle);
  }, []);

  if (!paused && enrichedAircraft !== displayedAircraft) {
    setDisplayedAircraft(enrichedAircraft);
  }

  const sortedAircraft = useMemo(
    () => sortAircraft(displayedAircraft, sortKey, sortDirection, props.location),
    [displayedAircraft, sortKey, sortDirection, props.location],
  );
  const filteredAircraft = useMemo(
    () => filterAircraft(sortedAircraft, activeFilter, props.location),
    [sortedAircraft, activeFilter, props.location],
  );
  const availability = useMemo(
    () => ({ source: props.source, location: props.location }),
    [props.source, props.location],
  );
  const available = useMemo(() => availableColumns(availability), [availability]);
  const columns = useMemo(
    () =>
      columnKeys === undefined
        ? autoFitColumns(available, terminalWidth)
        : selectColumns(available, columnKeys),
    [available, columnKeys, terminalWidth],
  );
  const sortCycle = useMemo(() => sortKeyCycle(columns), [columns]);
  const watchedCount = useMemo(
    () =>
      displayedAircraft.filter((aircraft) => matchesWatchlist(aircraft, props.watchlist)).length,
    [displayedAircraft, props.watchlist],
  );
  const visibleWatchedCount = useMemo(
    () => filteredAircraft.filter((aircraft) => matchesWatchlist(aircraft, props.watchlist)).length,
    [filteredAircraft, props.watchlist],
  );

  const firstSortKey = sortCycle[0];
  if (!sortCycle.includes(sortKey) && firstSortKey !== undefined) {
    setSortKey(firstSortKey);
  }

  const firstAircraft = filteredAircraft[0];
  if (selectedIcaoHex === undefined && firstAircraft !== undefined) {
    setSelectedIcaoHex(firstAircraft.icaoHex);
  }

  const selectedAircraft = filteredAircraft.find(
    (aircraft) => aircraft.icaoHex === selectedIcaoHex,
  );

  function handleSearchSubmit(query: string): void {
    setSearching(false);
    const trimmed = query.trim();
    if (trimmed === '') {
      setSubmittedSearchQuery(undefined);
      return;
    }
    setSubmittedSearchQuery(trimmed);
    const match = findMatchIcaoHex(filteredAircraft, trimmed, selectedIcaoHex, 1);
    if (match !== undefined) {
      setSelectedIcaoHex(match);
    }
  }

  function handleFilterChange(query: string): void {
    setFilterQuery(query);
    setFilterError(undefined);
  }

  function handleFilterSubmit(query: string): void {
    if (query.trim() === '') {
      setFiltering(false);
      setFilterError(undefined);
      setActiveFilter(undefined);
      return;
    }
    const parsed = parseFilter(query, props.location !== undefined, units);
    if ('message' in parsed) {
      setFilterError(parsed.message);
      return;
    }
    setFiltering(false);
    setFilterError(undefined);
    setActiveFilter(parsed);
    const matches = filterAircraft(sortedAircraft, parsed, props.location);
    if (!matches.some((aircraft) => aircraft.icaoHex === selectedIcaoHex)) {
      setSelectedIcaoHex(matches[0]?.icaoHex);
    }
  }

  function handleSnapshot(): void {
    const fileName = snapshotFileName(Date.now());
    const csv = buildSnapshotCsv(filteredAircraft, columns, {
      nowMs: now,
      location: props.location,
      units,
    });
    const write = props.writeSnapshot ?? writeSnapshotFile;
    write(fileName, csv).then(
      () => setNotice({ text: `saved ${fileName}`, kind: 'ok', at: Date.now() }),
      (error: unknown) =>
        setNotice({
          text: `snapshot failed: ${error instanceof Error ? error.message : String(error)}`,
          kind: 'error',
          at: Date.now(),
        }),
    );
  }

  function toggleColumnAtCursor(): void {
    const target = available[pickerIndex];
    if (target === undefined) {
      return;
    }
    const shownKeys = columns.map((column) => column.key);
    const nextKeys = shownKeys.includes(target.key)
      ? shownKeys.filter((key) => key !== target.key)
      : [...shownKeys, target.key];
    if (nextKeys.length === 0) {
      return;
    }
    setColumnKeys(nextKeys);
  }

  function handlePickerInput(input: string, key: Key): void {
    if (key.escape || key.return || input === 'c' || input === 'C') {
      setPanel('table');
      return;
    }
    if (key.upArrow) {
      setPickerIndex((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setPickerIndex((prev) => Math.min(available.length - 1, prev + 1));
      return;
    }
    switch (input) {
      case ' ':
        toggleColumnAtCursor();
        break;
      case 'a':
      case 'A':
        setColumnKeys(available.map((column) => column.key));
        break;
      case 'm':
      case 'M':
        setColumnKeys(minimalColumnKeys());
        break;
      case 'f':
      case 'F':
        setColumnKeys(undefined);
        break;
      default:
        break;
    }
  }

  useInput(
    (input, key) => {
      if (input === 'q' || input === 'Q') {
        exit();
        return;
      }
      if (panel === 'columns') {
        handlePickerInput(input, key);
        return;
      }
      if (key.escape) {
        if (panel !== 'table') {
          setPanel('table');
        } else if (activeFilter !== undefined) {
          setActiveFilter(undefined);
        }
        return;
      }
      if (key.upArrow) {
        setSelectedIcaoHex((prev) => moveSelection(filteredAircraft, prev, -1));
        return;
      }
      if (key.downArrow) {
        setSelectedIcaoHex((prev) => moveSelection(filteredAircraft, prev, 1));
        return;
      }
      if (key.return) {
        if (selectedAircraft !== undefined) {
          setPanel((prev) => (prev === 'detail' ? 'table' : 'detail'));
        }
        return;
      }
      switch (input) {
        case 'p':
        case 'P':
          setPaused((prev) => !prev);
          break;
        case 'c':
        case 'C':
          setPickerIndex(0);
          setPanel('columns');
          break;
        case 'h':
        case 'H':
          setPanel((prev) => (prev === 'help' ? 'table' : 'help'));
          break;
        case 'o':
          setSortKey((prev) => nextSortKey(prev, sortCycle, 1));
          break;
        case 'O':
          setSortKey((prev) => nextSortKey(prev, sortCycle, -1));
          break;
        case 'r':
        case 'R':
          setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
          break;
        case 'b':
        case 'B':
          setShowStatus((prev) => !prev);
          break;
        case 'd':
        case 'D':
          if (selectedAircraft !== undefined) {
            setPanel((prev) => (prev === 'detail' ? 'table' : 'detail'));
          }
          break;
        case 's':
        case 'S':
          setSearching(true);
          setSearchQuery('');
          break;
        case 'f':
        case 'F':
          setFiltering(true);
          setFilterQuery(activeFilter?.text ?? '');
          setFilterError(undefined);
          break;
        case 'm':
        case 'M':
          setShowMessages((prev) => !prev);
          break;
        case 't':
        case 'T':
          setShowStats((prev) => !prev);
          break;
        case 'w':
        case 'W':
          handleSnapshot();
          break;
        case 'u':
        case 'U':
          setUnits((prev) => toggleUnitSystem(prev));
          break;
        case 'v':
        case 'V':
          setMessageVerbosity((prev) => (prev === 'all' ? 'newAndLost' : 'all'));
          break;
        case 'n':
          if (submittedSearchQuery !== undefined) {
            setSelectedIcaoHex(
              (prev) => findMatchIcaoHex(filteredAircraft, submittedSearchQuery, prev, 1) ?? prev,
            );
          }
          break;
        case 'N':
          if (submittedSearchQuery !== undefined) {
            setSelectedIcaoHex(
              (prev) => findMatchIcaoHex(filteredAircraft, submittedSearchQuery, prev, -1) ?? prev,
            );
          }
          break;
        default:
          break;
      }
    },
    { isActive: !searching && !filtering },
  );

  useInput(
    (_input, key) => {
      if (key.escape) {
        setSearching(false);
        setFiltering(false);
      }
    },
    { isActive: searching || filtering },
  );

  return (
    <Box flexDirection="column">
      {showStatus ? (
        <StatusHeader
          source={props.source}
          host={props.host}
          port={props.port}
          aircraftCount={view.aircraft.length}
          messageCount={view.messageCount}
          messageRatePerSec={view.messageRatePerSec}
          lastMessageAt={view.lastMessageAt}
          nowMs={now}
          paused={paused}
          connectionState={view.connectionState}
          filter={
            activeFilter === undefined
              ? undefined
              : { text: activeFilter.text, matchCount: filteredAircraft.length }
          }
          watch={
            props.watchlist.length === 0
              ? undefined
              : { matchCount: watchedCount, hiddenCount: watchedCount - visibleWatchedCount }
          }
          recordPath={props.recordPath}
          notice={
            notice !== undefined && now - notice.at < NOTICE_MS
              ? { text: notice.text, kind: notice.kind }
              : undefined
          }
        />
      ) : undefined}
      {panel === 'help' ? (
        <HelpOverlay />
      ) : panel === 'columns' ? (
        <ColumnPicker
          availableColumns={available}
          unavailableColumns={unavailableColumns(availability)}
          selectedKeys={columns.map((column) => column.key)}
          cursorIndex={pickerIndex}
          autoFit={columnKeys === undefined}
          terminalWidth={terminalWidth}
          tableWidth={tableRowWidth(columns) + TABLE_CHROME_WIDTH}
        />
      ) : panel === 'detail' && selectedAircraft !== undefined ? (
        <DetailView
          aircraft={selectedAircraft}
          nowMs={now}
          location={props.location}
          messageCount={view.messageCountByHex.get(selectedAircraft.icaoHex) ?? 0}
          units={units}
        />
      ) : (
        <AircraftTable
          aircraft={filteredAircraft}
          columns={columns}
          nowMs={now}
          location={props.location}
          watchlist={props.watchlist}
          firstSeenAtByHex={view.firstSeenAtByHex}
          staleAfterMs={props.staleAfterMs}
          units={units}
          sortKey={sortKey}
          sortDirection={sortDirection}
          selectedIcaoHex={selectedIcaoHex}
        />
      )}
      {showStats ? (
        <StatsPanel
          startedAt={view.startedAt}
          nowMs={now}
          aircraftCount={view.aircraft.length}
          peakAircraftCount={view.peakAircraftCount}
          uniqueAircraftCount={view.uniqueAircraftCount}
          messageCount={view.messageCount}
          messageRatePerSec={view.messageRatePerSec}
          rateHistory={view.rateHistory}
          maxDistance={view.maxDistance}
          hasLocation={props.location !== undefined}
          units={units}
        />
      ) : undefined}
      {showMessages ? (
        <MessagesPanel
          entries={messageVerbosity === 'newAndLost' ? view.newAndLostLog : view.messageLog}
          verbosity={messageVerbosity}
        />
      ) : undefined}
      {searching ? (
        <SearchBar query={searchQuery} onChange={setSearchQuery} onSubmit={handleSearchSubmit} />
      ) : undefined}
      {filtering ? (
        <FilterBar
          query={filterQuery}
          error={filterError}
          onChange={handleFilterChange}
          onSubmit={handleFilterSubmit}
          units={units}
        />
      ) : undefined}
      <HotkeyBar
        paused={paused}
        sortDirection={sortDirection}
        showMessages={showMessages}
        showStats={showStats}
        showStatus={showStatus}
        hasActiveSearch={submittedSearchQuery !== undefined}
        hasActiveFilter={activeFilter !== undefined}
        units={units}
      />
    </Box>
  );
}
