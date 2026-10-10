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
import type { ScopeModeDefinition } from '../modes/mode.js';
import { SCOPE_MODES, SCOPE_MODES_BY_ID } from '../modes/registry.js';

import { HIDE_CONTROLS_LABEL, SHOW_CONTROLS_LABEL } from './controls-visibility.js';
import {
  MEASURE_LABEL,
  ModeControls,
  STOP_MEASURING_LABEL,
  VIEW_STYLE_CAPTION,
} from './mode-controls.js';

const ANALOG = SCOPE_MODES_BY_ID.analog;
const DIGITAL = SCOPE_MODES_BY_ID.digital;
const BARE_MODE: ScopeModeDefinition = { ...DIGITAL, settings: [] };

describe('ModeControls', () => {
  it('offers every view style side by side, with the active one marked as selected', () => {
    render(
      <ModeControls
        modes={SCOPE_MODES}
        mode={DIGITAL}
        settingValues={{}}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
        expanded
        onToggleExpanded={vi.fn()}
        measuring={false}
        onToggleMeasure={vi.fn()}
      />,
    );

    const group = screen.getByRole('group', { name: 'View style' });
    expect(group).toHaveTextContent(VIEW_STYLE_CAPTION);
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
        mode={BARE_MODE}
        settingValues={{}}
        onSelectMode={vi.fn()}
        onSelectSetting={vi.fn()}
        expanded
        onToggleExpanded={vi.fn()}
        measuring={false}
        onToggleMeasure={vi.fn()}
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
        expanded
        onToggleExpanded={vi.fn()}
        measuring={false}
        onToggleMeasure={vi.fn()}
      />,
    );

    expect(screen.getAllByRole('group')).toHaveLength(1 + ANALOG.settings.length);
    const tags = screen.getByRole('group', { name: 'Tags' });
    expect(tags).toHaveTextContent('Tags');
    expect(within(tags).getByRole('button', { name: 'Tags: On' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(tags).getByRole('button', { name: 'Tags: Off' })).toHaveAttribute(
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
        expanded
        onToggleExpanded={vi.fn()}
        measuring={false}
        onToggleMeasure={vi.fn()}
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
        expanded
        onToggleExpanded={vi.fn()}
        measuring={false}
        onToggleMeasure={vi.fn()}
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
        expanded
        onToggleExpanded={vi.fn()}
        measuring={false}
        onToggleMeasure={vi.fn()}
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

  describe('measuring', () => {
    it('offers to start a range/bearing line, naming the keys that start and clear one', () => {
      const onToggleMeasure = vi.fn();
      render(
        <ModeControls
          modes={SCOPE_MODES}
          mode={DIGITAL}
          settingValues={defaultSettingValues(DIGITAL)}
          onSelectMode={vi.fn()}
          onSelectSetting={vi.fn()}
          expanded
          onToggleExpanded={vi.fn()}
          measuring={false}
          onToggleMeasure={onToggleMeasure}
        />,
      );

      const button = screen.getByRole('button', { name: MEASURE_LABEL });
      expect(button).toHaveAttribute('title', 'B starts a range/bearing line; Escape clears it');
      fireEvent.click(button);
      expect(onToggleMeasure).toHaveBeenCalledTimes(1);
    });

    it('offers to stop measuring while a line is armed or drawn', () => {
      render(
        <ModeControls
          modes={SCOPE_MODES}
          mode={DIGITAL}
          settingValues={defaultSettingValues(DIGITAL)}
          onSelectMode={vi.fn()}
          onSelectSetting={vi.fn()}
          expanded
          onToggleExpanded={vi.fn()}
          measuring
          onToggleMeasure={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', { name: STOP_MEASURING_LABEL })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: MEASURE_LABEL })).not.toBeInTheDocument();
    });
  });

  describe('hiding and showing', () => {
    it('offers to hide the selectors while they are showing, naming its key', () => {
      const onToggleExpanded = vi.fn();
      render(
        <ModeControls
          modes={SCOPE_MODES}
          mode={ANALOG}
          settingValues={defaultSettingValues(ANALOG)}
          onSelectMode={vi.fn()}
          onSelectSetting={vi.fn()}
          expanded
          onToggleExpanded={onToggleExpanded}
          measuring={false}
          onToggleMeasure={vi.fn()}
        />,
      );

      const toggle = screen.getByRole('button', { name: HIDE_CONTROLS_LABEL });
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(toggle).toHaveAttribute('title', 'H hides and shows the controls');
      fireEvent.click(toggle);
      expect(onToggleExpanded).toHaveBeenCalledTimes(1);
    });

    it('leaves only the button that shows them again once they are hidden', () => {
      render(
        <ModeControls
          modes={SCOPE_MODES}
          mode={ANALOG}
          settingValues={defaultSettingValues(ANALOG)}
          onSelectMode={vi.fn()}
          onSelectSetting={vi.fn()}
          expanded={false}
          onToggleExpanded={vi.fn()}
          measuring={false}
          onToggleMeasure={vi.fn()}
        />,
      );

      expect(screen.queryAllByRole('group')).toHaveLength(0);
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0]).toHaveAccessibleName(SHOW_CONTROLS_LABEL);
      expect(buttons[0]).toHaveAttribute('aria-expanded', 'false');
    });
  });
});
