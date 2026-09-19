// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { SCOPE_MODES } from '../modes/registry.js';

import { applyTheme, canvasFont, themeCssVariables } from './theme.js';
import type { ScopeTheme } from './theme.js';

const STYLESHEETS: Record<string, string> = import.meta.glob('../**/*.css', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const THEME: ScopeTheme = {
  canvas: {
    background: '#000000',
    map: '#111111',
    mapLabel: '#222222',
    target: '#333333',
    coasting: '#444444',
    history: '#555555',
    vector: '#666666',
  },
  ui: {
    background: '#001100',
    text: '#33ff66',
    emphasis: '#aaffbb',
    ok: '#33ff67',
    alert: '#ffee55',
    controlBackground: '#002200',
    controlBorder: '#116611',
  },
  fontFamily: 'Courier New, monospace',
  fontSizeRem: 0.875,
};

describe('canvasFont', () => {
  it("converts the theme's rem font size to pixels at the current scale", () => {
    expect(canvasFont(THEME, 16)).toBe('14px Courier New, monospace');
    expect(canvasFont(THEME, 20)).toBe('17.5px Courier New, monospace');
  });
});

describe('themeCssVariables', () => {
  it('publishes every UI color and the font fields, with the font size in rem', () => {
    expect(themeCssVariables(THEME)).toEqual({
      '--scope-ui-background': '#001100',
      '--scope-ui-text': '#33ff66',
      '--scope-ui-emphasis': '#aaffbb',
      '--scope-ui-ok': '#33ff67',
      '--scope-ui-alert': '#ffee55',
      '--scope-ui-control-background': '#002200',
      '--scope-ui-control-border': '#116611',
      '--scope-font-family': 'Courier New, monospace',
      '--scope-font-size': '0.875rem',
    });
  });
});

describe('the stylesheet contract', () => {
  const css = Object.values(STYLESHEETS).join('\n');
  const published = Object.keys(themeCssVariables(THEME));
  const layoutTokens = [...css.matchAll(/^\s*(--scope-[\w-]+)\s*:/gm)].map((match) => match[1]);
  const used = [...new Set([...css.matchAll(/var\((--scope-[\w-]+)\)/g)].map((match) => match[1]))];

  it('finds the stylesheets', () => {
    expect(Object.keys(STYLESHEETS).length).toBeGreaterThan(1);
  });

  it('defines every custom property the stylesheets use', () => {
    expect([...published, ...layoutTokens]).toEqual(expect.arrayContaining(used));
  });

  it('uses every custom property a theme publishes', () => {
    expect(used).toEqual(expect.arrayContaining(published));
  });

  it('keeps literal colors and font names out of the stylesheets', () => {
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    const fontFamilies = [...css.matchAll(/font-family:\s*([^;]+);/g)].map((match) => match[1]);
    expect(fontFamilies.length).toBeGreaterThan(0);
    for (const value of fontFamilies) {
      expect(value).toMatch(/^(var\(--scope-font-family\)|inherit)$/);
    }
  });

  it('sizes layout in rem rather than pixels', () => {
    expect(css).not.toMatch(/\d+px\b/);
  });
});

describe('every registered mode', () => {
  it('has a complete theme', () => {
    for (const mode of SCOPE_MODES) {
      for (const value of Object.values(themeCssVariables(mode.theme))) {
        expect(value).not.toBe('');
      }
      expect(mode.theme.fontSizeRem).toBeGreaterThan(0);
    }
  });
});

describe('applyTheme', () => {
  it('sets every custom property on the element', () => {
    const element = document.createElement('div');

    applyTheme(element, THEME);

    for (const [name, value] of Object.entries(themeCssVariables(THEME))) {
      expect(element.style.getPropertyValue(name)).toBe(value);
    }
  });

  it('overwrites a previously applied theme', () => {
    const element = document.createElement('div');

    applyTheme(element, { ...THEME, fontSizeRem: 1 });
    applyTheme(element, THEME);

    expect(element.style.getPropertyValue('--scope-font-size')).toBe('0.875rem');
  });
});
