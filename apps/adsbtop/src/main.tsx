import { render } from 'ink';

import { App } from './app.js';
import { run } from './run.js';

const result = run(process.argv.slice(2), {
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
});

if ('exitCode' in result) {
  process.exitCode = result.exitCode;
} else {
  const { options, feed } = result.dashboard;
  // The alternate screen buffer, as top/htop/less use: the app draws on its
  // own screen and the shell's scrollback is untouched and restored on exit.
  render(
    <App
      feed={feed}
      source={options.source}
      host={options.host}
      port={options.port}
      location={options.location}
      columnKeys={options.columnKeys}
      filter={options.filter}
      staleAfterMs={options.staleAfterMs}
      watchlist={options.watchlist}
      alertEmergency={options.alertEmergency}
      bell={options.bell}
      recordPath={options.recordPath}
      units={options.units}
    />,
    { alternateScreen: true },
  );
}
