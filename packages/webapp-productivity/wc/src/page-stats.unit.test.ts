/**
 * Tests for the stat-tile markup and mappings.
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
  STAT_FIELDS,
  STAT_TILES,
} from './page-stats.ts';

await describe({
  name: '',
  children: [
    describe({
      name: renderStatsSection.name,
      children: [
        it({
          name: 'renders a heading and a tiles definition list',
          fn: async function rendersHeadingAndTiles(): Promise<void> {
            /**
             * Full markup produced for the Stats section.
             */
            const html = renderStatsSection();

            expect(html,).toContain('<h2>Stats</h2>',);
            expect(html,).toContain('<dl class="tiles">',);
          },
        },),
        it({
          name: 'renders every STAT_TILES entry as a zero-valued labeled tile',
          fn: async function rendersEveryTile(): Promise<void> {
            /**
             * Full markup produced for the Stats section.
             */
            const html = renderStatsSection();

            for (
              const {
                label,
                id,
              } of STAT_TILES
            ) {
              expect(html,).toContain(`<dt class="tile-label">${label}</dt>`,);
              expect(html,).toContain(
                `<dd class="tile-value" id="${id}">0</dd>`,
              );
            }
          },
        },),
        it({
          name: 'renders a longest sub-line with unit for every paired tile',
          fn: async function rendersSubLines(): Promise<void> {
            /**
             * Full markup produced for the Stats section.
             */
            const html = renderStatsSection();

            for (const tile of STAT_TILES) {
              if (tile.sub !== undefined) {
                expect(html,).toContain(
                  `longest <span id="${tile.sub.id}">0</span> ${tile.sub.unit}`,
                );
              }
            }
          },
        },),
        it({
          name: 'pairs lines/words/sentences/paragraphs and leaves bytes/chars bare',
          fn: async function pairsExpectedTiles(): Promise<void> {
            /**
             * Labels of tiles carrying a "longest" sub-stat.
             */
            const paired = STAT_TILES
              .filter(function hasSub(tile,): boolean {
                return tile.sub !== undefined;
              },)
              .map(function toLabel(tile,): string {
                return tile.label;
              },)
              .toSorted();

            expect(paired,).toEqual(
              [
                'Lines',
                'Paragraphs',
                'Sentences',
                'Words',
              ],
            );
          },
        },),
      ],
    },),
    describe({
      name: 'STAT_FIELDS',
      children: [
        it({
          name: 'flattens every headline and sub id/key pairing exactly once',
          fn: async function flattensAllPairings(): Promise<void> {
            /**
             * Ids collected from tiles directly, for comparison.
             */
            const expectedIds = STAT_TILES
              .flatMap(function collectIds(tile,): readonly string[] {
                return tile.sub === undefined
                  ? [tile.id,]
                  : [
                    tile.id,
                    tile.sub.id,
                  ];
              },);

            expect(
              STAT_FIELDS.map(function toId(field,): string {
                return field.id;
              },),
            ).toEqual(expectedIds,);
            expect(new Set(expectedIds,).size,).toBe(expectedIds.length,);
          },
        },),
      ],
    },),
  ],
},);
