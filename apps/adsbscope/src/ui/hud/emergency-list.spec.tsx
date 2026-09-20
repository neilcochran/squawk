// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { makeSnapshot, makeTarget } from '../scope/test-utils.js';

import { EMERGENCY_LIST_LABEL, EmergencyList } from './emergency-list.js';

describe('EmergencyList', () => {
  it('shows nothing before the first snapshot, or while nothing is in an emergency', () => {
    const { container, rerender } = render(<EmergencyList snapshot={undefined} />);
    expect(container).toBeEmptyDOMElement();

    rerender(<EmergencyList snapshot={makeSnapshot([makeTarget({ squawk: '1200' })])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the aircraft in an emergency as an alert, with their code and squawk', () => {
    const snapshot = makeSnapshot([
      makeTarget({ icaoHex: 'a00001', callsign: 'UAL123', squawk: '7700', emergency: 'general' }),
      makeTarget({ icaoHex: 'c0ffee', emergency: 'resolutionAdvisory' }),
      makeTarget({ icaoHex: 'a00002', callsign: 'DAL45' }),
    ]);

    render(<EmergencyList snapshot={snapshot} />);

    const list = screen.getByRole('alert', { name: EMERGENCY_LIST_LABEL });
    expect(within(list).getByRole('heading', { name: EMERGENCY_LIST_LABEL })).toBeInTheDocument();
    const rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('C0FFEE RA');
    expect(rows[1]).toHaveTextContent('UAL123 EM');
    expect(rows[1]).toHaveTextContent('7700');
  });
});
