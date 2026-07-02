/**
 * Tests for the light/dark color-scheme stylesheet fragments.
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

await describe({
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
        expect(css,).toContain('--color-fg:',);
        expect(css,).toContain('--color-bg:',);
        expect(css,).toContain('--color-muted:',);
        expect(css,).toContain('--color-divider:',);
        expect(css,).toContain('--color-placeholder:',);
      },
    },),
  ],
},);

await describe({
  name: renderDarkColors.name,
  children: [
    it({
      name: 'overrides every custom property inside a prefers-color-scheme: dark query',
      fn: async function overridesInDarkMediaQuery(): Promise<void> {
        /**
         * `@media (prefers-color-scheme: dark)` rule with overridden custom properties.
         */
        const css = renderDarkColors();

        expect(css.startsWith('@media (prefers-color-scheme: dark){',),).toBe(true,);
        expect(css,).toContain('--color-fg:',);
        expect(css,).toContain('--color-bg:',);
        expect(css,).toContain('--color-muted:',);
        expect(css,).toContain('--color-divider:',);
        expect(css,).toContain('--color-placeholder:',);
      },
    },),
  ],
},);
