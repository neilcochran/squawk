// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  SWEEP_SETTING,
  TAGS_ON,
  TAGS_SETTING,
  TAGS_SETTING_ID,
} from '../modes/analog/analog-settings.js';
import { defaultSettingValues } from '../modes/mode.js';
import { SCOPE_MODES, SCOPE_MODES_BY_ID } from '../modes/registry.js';

import { ModeControls } from './mode-controls.js';

const ANALOG = SCOPE_MODES_BY_ID.analog;
const DIGITAL = SCOPE_MODES_BY_ID.digital;

describe('ModeControls', () => {
  it('offers every view style side by side, with the active one marked as selected', () => {
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={DIGITAL}
        settingValues={{}}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'View style' });
    expect(within(group).getAllByRole('button')).toHaveLength(SCOPE_MODES.length);
    expect(screen.getByRole('button', { name: 'View style: Digital' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'View style: Analog' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('shows no settings for a mode that declares none', () => {
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={DIGITAL}
        settingValues={{}}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('group')).toHaveLength(1);
  });

  it("adds a captioned selector per setting the mode declares, marking each setting's selected choice", () => {
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={ANALOG}
        settingValues={defaultSettingValues(ANALOG)}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('group')).toHaveLength(1 + ANALOG.settings.length);
    const tags = screen.getByRole('group', { name: 'Tags' });
    expect(tags).toHaveTextContent('Tags');
    expect(within(tags).getByRole('button', { name: 'Tags: Off' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(tags).getByRole('button', { name: 'Tags: On' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(screen.getByRole('button', { name: 'Sweep: 4.8 s' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('reflects a changed setting value', () => {
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={ANALOG}
        settingValues={{ ...defaultSettingValues(ANALOG), [TAGS_SETTING_ID]: TAGS_ON }}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Tags: On' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Tags: Off' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('reports exactly which view style and which setting value was chosen', () => {
    const onSelectMode = vi.fn();
    const onSelectSetting = vi.fn();
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={ANALOG}
        settingValues={defaultSettingValues(ANALOG)}
        onSelectMode={onSelectMode}
        onSelectSetting={onSelectSetting}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'View style: Digital' }));
    fireEvent.click(screen.getByRole('button', { name: 'Tags: On' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sweep: 12 s' }));

    expect(onSelectMode.mock.calls).toEqual([['digital']]);
    expect(onSelectSetting.mock.calls).toEqual([
      [TAGS_SETTING, TAGS_ON],
      [SWEEP_SETTING, 'longRange'],
    ]);
  });

  it('names the hotkey for each control in its tooltip', () => {
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={ANALOG}
        settingValues={defaultSettingValues(ANALOG)}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'View style: Analog' })).toHaveAttribute(
      'title',
      'M switches view style',
    );
    expect(screen.getByRole('button', { name: 'Tags: On' })).toHaveAttribute(
      'title',
      'T changes tags',
    );
  });
});
