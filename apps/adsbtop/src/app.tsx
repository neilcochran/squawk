import { Box, useApp, useInput } from 'ink';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

import type { AircraftFeed } from '@squawk/adsb-feed';
import type { Aircraft } from '@squawk/types';

import type { FeedSource } from './cli-args.js';
import { nextSortKey, sortAircraft, visibleColumns } from './columns.js';
import type { SortKey } from './columns.js';
import { AircraftTable } from './components/aircraft-table.js';
import { HelpOverlay } from './components/help-overlay.js';
import { HotkeyBar } from './components/hotkey-bar.js';
import { StatusHeader } from './components/status-header.js';
import { useAircraftFeed } from './use-aircraft-feed.js';

/** How often the age column and status-header "last update" text refresh. */
const CLOCK_TICK_MS = 1000;
/** Sort key adsbtop starts with. */
const INITIAL_SORT_KEY: SortKey = 'icaoHex';

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
}

/**
 * adsbtop's root component: subscribes to the feed, owns display state
 * (pause, compact columns, sort, help), wires the hotkey bar, and renders
 * the status header, aircraft table, and optional help overlay.
 *
 * `[P]ause` freezes what the table displays without stopping the
 * underlying feed - `displayedAircraft` only re-syncs to the live feed
 * while `paused` is false, so resuming immediately shows the current state
 * rather than replaying what was missed.
 *
 * @param props - The feed to display and its connection details.
 */
export function App(props: AppProps): ReactElement {
  const { exit } = useApp();
  const view = useAircraftFeed(props.feed);

  const [paused, setPaused] = useState(false);
  const [compact, setCompact] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>(INITIAL_SORT_KEY);
  const [now, setNow] = useState(() => Date.now());
  const [displayedAircraft, setDisplayedAircraft] = useState<Aircraft[]>(view.aircraft);

  useEffect(() => {
    const handle = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(handle);
  }, []);

  // Adjusted during render (React's "adjusting state when a prop changes"
  // pattern), not via useEffect - an effect-based sync here would cascade an
  // extra render and trips react-hooks/set-state-in-effect.
  if (!paused && view.aircraft !== displayedAircraft) {
    setDisplayedAircraft(view.aircraft);
  }

  useInput((input, key) => {
    if (input === 'q' || input === 'Q') {
      exit();
      return;
    }
    if (key.escape && showHelp) {
      setShowHelp(false);
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
        setShowHelp((prev) => !prev);
        break;
      case 'o':
      case 'O':
        setSortKey((prev) => nextSortKey(prev));
        break;
      default:
        break;
    }
  });

  const sortedAircraft = useMemo(
    () => sortAircraft(displayedAircraft, sortKey),
    [displayedAircraft, sortKey],
  );
  const columns = useMemo(() => visibleColumns(compact), [compact]);

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
      />
      {showHelp ? (
        <HelpOverlay />
      ) : (
        <AircraftTable aircraft={sortedAircraft} columns={columns} nowMs={now} sortKey={sortKey} />
      )}
      <HotkeyBar paused={paused} />
    </Box>
  );
}
