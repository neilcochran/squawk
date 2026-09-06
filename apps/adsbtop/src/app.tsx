import { Box, useApp, useInput } from 'ink';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { AircraftFeed } from '@squawk/adsb-feed';
import type { Aircraft, Coordinates } from '@squawk/types';

import type { FeedSource } from './cli-args.js';
import { nextSortKey, sortAircraft, visibleColumns } from './columns.js';
import type { SortKey } from './columns.js';
import { AircraftTable } from './components/aircraft-table.js';
import { DetailView } from './components/detail-view.js';
import { HelpOverlay } from './components/help-overlay.js';
import { HotkeyBar } from './components/hotkey-bar.js';
import { MessagesPanel } from './components/messages-panel.js';
import type { MessageVerbosity } from './components/messages-panel.js';
import { SearchBar } from './components/search-bar.js';
import { StatusHeader } from './components/status-header.js';
import { enrichAircraftList } from './registration-cache.js';
import type { RegistrationCache } from './registration-cache.js';
import { findMatchIcaoHex } from './search.js';
import { moveSelection } from './selection.js';
import { useAircraftFeed } from './use-aircraft-feed.js';
import { useIcaoRegistry } from './use-icao-registry.js';
import type { RegistryDataLoader } from './use-icao-registry.js';

/** How often the age column and status-header "last update" text refresh. */
const CLOCK_TICK_MS = 1000;
/** Sort key adsbtop starts with. */
const INITIAL_SORT_KEY: SortKey = 'icaoHex';

/** Which content fills the main area below the status header. */
type Panel = 'table' | 'help' | 'detail';

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
  /** Configured receiver location (`--lat`/`--lon`), if any. Enables the table's Dist/Brg columns when set. */
  location: Coordinates | undefined;
}

/**
 * adsbtop's root component: subscribes to the feed, owns display state
 * (pause, compact columns, sort, cursor, search, messages, and which main
 * panel is showing), wires the hotkey bar, and renders the status header,
 * main panel, optional messages panel, optional search prompt, and hotkey
 * bar.
 *
 * `[P]ause` freezes the table's displayed rows (the feed keeps running
 * underneath - resuming immediately jumps to current state, doesn't replay
 * what was missed). Implemented as a React "adjust state during render"
 * pattern (comparing the live feed's aircraft-array reference against what's
 * displayed, copying over only while not paused), not a `useEffect`, since
 * an effect-based version of this exact pattern trips
 * `react-hooks/set-state-in-effect` and cascades an extra render. The cursor
 * row's auto-selection uses the same render-time-adjustment pattern for the
 * same reason.
 *
 * @param props - The feed to display and its connection details.
 */
export function App(props: AppProps): ReactElement {
  const { exit } = useApp();
  const view = useAircraftFeed(props.feed);
  const registry = useIcaoRegistry(props.registryDataLoader);
  const [registrationCache] = useState<RegistrationCache>(() => new Map());
  const enrichedAircraft = useMemo(
    () => enrichAircraftList(view.aircraft, registry, registrationCache),
    [view.aircraft, registry, registrationCache],
  );

  const [paused, setPaused] = useState(false);
  const [compact, setCompact] = useState(false);
  const [panel, setPanel] = useState<Panel>('table');
  const [sortKey, setSortKey] = useState<SortKey>(INITIAL_SORT_KEY);
  const [now, setNow] = useState(() => Date.now());
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>(enrichedAircraft);
  const [selectedIcaoHex, setSelectedIcaoHex] = useState<string | undefined>(undefined);
  const [showMessages, setShowMessages] = useState(false);
  const [messageVerbosity, setMessageVerbosity] = useState<MessageVerbosity>('newAndLost');
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submittedSearchQuery, setSubmittedSearchQuery] = useState<string | undefined>(undefined);

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(handle);
  }, []);

  if (!paused && enrichedAircraft !== displayedAircraft) {
    setDisplayedAircraft(enrichedAircraft);
  }

  const sortedAircraft = useMemo(
    () => sortAircraft(displayedAircraft, sortKey),
    [displayedAircraft, sortKey],
  );
  const columns = useMemo(() => visibleColumns(compact, props.location), [compact, props.location]);

  const firstAircraft = sortedAircraft[0];
  if (selectedIcaoHex === undefined && firstAircraft !== undefined) {
    setSelectedIcaoHex(firstAircraft.icaoHex);
  }

  const selectedAircraft = sortedAircraft.find((aircraft) => aircraft.icaoHex === selectedIcaoHex);

  function handleSearchSubmit(query: string): void {
    setSearching(false);
    const trimmed = query.trim();
    if (trimmed === '') {
      setSubmittedSearchQuery(undefined);
      return;
    }
    setSubmittedSearchQuery(trimmed);
    const match = findMatchIcaoHex(sortedAircraft, trimmed, selectedIcaoHex, 1);
    if (match !== undefined) {
      setSelectedIcaoHex(match);
    }
  }

  useInput(
    (input, key) => {
      if (input === 'q' || input === 'Q') {
        exit();
        return;
      }
      if (key.escape) {
        if (panel !== 'table') {
          setPanel('table');
        }
        return;
      }
      if (key.upArrow) {
        setSelectedIcaoHex((prev) => moveSelection(sortedAircraft, prev, -1));
        return;
      }
      if (key.downArrow) {
        setSelectedIcaoHex((prev) => moveSelection(sortedAircraft, prev, 1));
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
          setCompact((prev) => !prev);
          break;
        case 'h':
        case 'H':
          setPanel((prev) => (prev === 'help' ? 'table' : 'help'));
          break;
        case 'o':
        case 'O':
          setSortKey((prev) => nextSortKey(prev));
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
        case 'm':
        case 'M':
          setShowMessages((prev) => !prev);
          break;
        case 'v':
        case 'V':
          setMessageVerbosity((prev) => (prev === 'all' ? 'newAndLost' : 'all'));
          break;
        case 'n':
          if (submittedSearchQuery !== undefined) {
            setSelectedIcaoHex(
              (prev) => findMatchIcaoHex(sortedAircraft, submittedSearchQuery, prev, 1) ?? prev,
            );
          }
          break;
        case 'N':
          if (submittedSearchQuery !== undefined) {
            setSelectedIcaoHex(
              (prev) => findMatchIcaoHex(sortedAircraft, submittedSearchQuery, prev, -1) ?? prev,
            );
          }
          break;
        default:
          break;
      }
    },
    { isActive: !searching },
  );

  useInput(
    (_input, key) => {
      if (key.escape) {
        setSearching(false);
      }
    },
    { isActive: searching },
  );

  return (
    <Box flexDirection="column">
      <StatusHeader
        source={props.source}
        host={props.host}
        port={props.port}
        aircraftCount={view.aircraft.length}
        messageRatePerSec={view.messageRatePerSec}
        lastMessageAt={view.lastMessageAt}
        nowMs={now}
        paused={paused}
        connectionState={view.connectionState}
      />
      {panel === 'help' ? (
        <HelpOverlay />
      ) : panel === 'detail' && selectedAircraft !== undefined ? (
        <DetailView aircraft={selectedAircraft} nowMs={now} location={props.location} />
      ) : (
        <AircraftTable
          aircraft={sortedAircraft}
          columns={columns}
          nowMs={now}
          sortKey={sortKey}
          selectedIcaoHex={selectedIcaoHex}
        />
      )}
      {showMessages ? (
        <MessagesPanel
          entries={messageVerbosity === 'newAndLost' ? view.newAndLostLog : view.messageLog}
          verbosity={messageVerbosity}
        />
      ) : undefined}
      {searching ? (
        <SearchBar query={searchQuery} onChange={setSearchQuery} onSubmit={handleSearchSubmit} />
      ) : undefined}
      <HotkeyBar
        paused={paused}
        showMessages={showMessages}
        hasActiveSearch={submittedSearchQuery !== undefined}
      />
    </Box>
  );
}
