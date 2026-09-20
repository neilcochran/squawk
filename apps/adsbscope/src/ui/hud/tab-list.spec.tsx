// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeSnapshot, makeTarget } from '../scope/test-utils.js';

import { TAB_LIST_MAX_ROWS } from './tab-list-content.js';
import { TAB_LIST_LABEL, TabList } from './tab-list.js';

describe('TabList', () => {
  it('shows nothing before the first snapshot, or while every aircraft is plotted', () => {
    const plotted = makeTarget({ position: { trueBearingDeg: 90, rangeNm: 10 } });

    const { container, rerender } = render(<TabList snapshot={undefined} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<TabList snapshot={makeSnapshot([plotted])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists the aircraft that have no position, under a heading', () => {
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'a00001', callsign: 'DAL45', altitudeFt: 12_000, groundSpeedKt: 300 }),
      makeTarget({ icaoHex: 'c0ffee' }),
    ]);

    render(<TabList snapshot={snapshot} />);

    const list = screen.getByRole('region', { name: TAB_LIST_LABEL });
    expect(within(list).getByRole('heading', { name: TAB_LIST_LABEL })).toBeInTheDocument();
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('C0FFEE');
    expect(rows[1]).toHaveTextContent('DAL45');
    expect(rows[1]).toHaveTextContent('120 30');
    expect(within(list).queryByText(/more/)).not.toBeInTheDocument();
  });

  it('counts the aircraft it has no room to name', () => {
    const targets = Array.from({ length: TAB_LIST_MAX_ROWS + 2 }, (_, index) =>
      makeTarget({ icaoHex: `a000${String(index).padStart(2, '0')}` }),
    );

    render(<TabList snapshot={makeSnapshot(targets)} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(TAB_LIST_MAX_ROWS);
    expect(screen.getByText('+2 more')).toBeInTheDocument();
  });
});
