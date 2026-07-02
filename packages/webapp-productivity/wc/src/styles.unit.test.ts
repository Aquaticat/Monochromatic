/**
 * Tests for the complete stylesheet assembly.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { renderStyles, } from './styles.ts';

await describe({
  name: renderStyles.name,
  children: [
    it({
      name: 'uses flexbox for the layout and stat rows, never CSS grid',
      fn: async function usesFlexboxNeverGrid(): Promise<void> {
        /**
         * Complete stylesheet string.
         */
        const css = renderStyles();

        expect(css,).toContain('.layout{display:flex',);
        expect(css,).toContain('.stat-row{display:flex',);
        expect(css,).not
          .toContain('display:grid',);
      },
    },),
    it({
      name: 'includes the wide-viewport media query and the color palette',
      fn: async function includesMediaQueryAndPalette(): Promise<void> {
        /**
         * Complete stylesheet string.
         */
        const css = renderStyles();

        expect(css,).toContain('@media (min-width: 48rem)',);
        expect(css,).toContain('--color-fg:',);
        expect(css,).toContain('@media (prefers-color-scheme: dark)',);
      },
    },),
  ],
},);
