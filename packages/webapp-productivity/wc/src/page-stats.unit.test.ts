/**
 * Tests for the Stats section markup.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  renderStatsSection,
  STAT_ROWS,
} from './page-stats.ts';

await describe({
  name: renderStatsSection.name,
  children: [
    it({
      name: 'renders a heading and a stats definition list',
      fn: async function rendersHeadingAndList(): Promise<void> {
        /**
         * Full markup produced for the Stats section.
         */
        const html = renderStatsSection();

        expect(html,).toContain('<h2>Stats</h2>',);
        expect(html,).toContain('<dl class="stats">',);
      },
    },),
    it({
      name: 'renders every STAT_ROWS entry as a zero-valued dt/dd pair',
      fn: async function rendersEveryStatRow(): Promise<void> {
        /**
         * Full markup produced for the Stats section.
         */
        const html = renderStatsSection();

        for (const { label, id, } of STAT_ROWS) {
          expect(html,).toContain(`<dt>${label}</dt>`,);
          expect(html,).toContain(`<dd id="${id}">0</dd>`,);
        }
      },
    },),
  ],
},);
