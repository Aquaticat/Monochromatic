/**
 * Tests for the light/dark color-scheme stylesheet fragments and the
 * strict five-stop grayscale palette.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  renderDarkColors,
  renderRootColors,
} from './styles-colors.ts';

/**
 * Custom-property names both palette fragments must declare.
 */
const TOKEN_NAMES = [
  '--color-bg:',
  '--color-surface:',
  '--color-fg:',
  '--color-fg-strong:',
  '--color-muted:',
  '--color-border-subtle:',
  '--color-border-strong:',
  '--color-bar:',
  '--color-placeholder:',
];

/**
 * The only lightness values the palette may use; the design decree is
 * strictly `oklch(L 0 0)` for these five stops, no alpha.
 */
const ALLOWED_STOPS = [
  'oklch(0 0 0)',
  'oklch(0.1 0 0)',
  'oklch(0.5 0 0)',
  'oklch(0.9 0 0)',
  'oklch(1 0 0)',
];

/**
 * Collects every `oklch(...)` function occurrence inside css via a
 * linear index scan (no regex).
 *
 * @param css - stylesheet fragment to scan
 *
 * @returns every `oklch(...)` substring, in source order
 */
function collectOklchValues(css: string,): readonly string[] {
  /**
   * `indexOf` sentinel for "no further occurrence".
   */
  const NOT_FOUND = -1;

  /**
   * Collected `oklch(...)` substrings.
   */
  const values: string[] = [];

  /**
   * Scan cursor advanced past each match.
   */
  let cursor = css.indexOf('oklch(',);

  while (cursor !== NOT_FOUND) {
    /**
     * Index of the closing parenthesis for the current occurrence.
     */
    const end = css.indexOf(
      ')',
      cursor,
    );

    if (end === NOT_FOUND) {
      break;
    }

    values.push(css.slice(
      cursor,
      end + 1,
    ),);
    cursor = css.indexOf(
      'oklch(',
      end,
    );
  }

  return values;
}

await describe({
  name: '',
  children: [
    describe({
      name: renderRootColors.name,
      children: [
        it({
          name: 'declares color-scheme and every custom property on :root',
          fn: async function declaresRootCustomProperties(): Promise<void> {
            /**
             * `:root` rule with light-theme custom properties.
             */
            const css = renderRootColors();

            expect(css.startsWith(':root{',),).toBe(true,);
            expect(css,).toContain('color-scheme:light dark',);
            for (const token of TOKEN_NAMES) {
              expect(css,).toContain(token,);
            }
          },
        },),
      ],
    },),
    describe({
      name: renderDarkColors.name,
      children: [
        it({
          name: 'overrides every custom property inside a prefers-color-scheme: dark query',
          fn: async function overridesInDarkMediaQuery(): Promise<void> {
            /**
             * `@media (prefers-color-scheme: dark)` rule with overridden
             * custom properties.
             */
            const css = renderDarkColors();

            expect(
              css.startsWith('@media (prefers-color-scheme: dark){',),
            ).toBe(true,);
            for (const token of TOKEN_NAMES) {
              expect(css,).toContain(token,);
            }
          },
        },),
      ],
    },),
    describe({
      name: 'five-stop palette discipline',
      children: [
        it({
          name: 'uses only the five decreed grayscale stops, with no alpha',
          fn: async function usesOnlyAllowedStops(): Promise<void> {
            /**
             * Both palette fragments concatenated for scanning.
             */
            const css = `${renderRootColors()}${renderDarkColors()}`;

            /**
             * Every oklch() occurrence in the palette.
             */
            const values = collectOklchValues(css,);

            expect(values.length,).toBeGreaterThan(0,);
            for (const value of values) {
              expect(ALLOWED_STOPS,).toContain(value,);
            }
          },
        },),
      ],
    },),
  ],
},);
