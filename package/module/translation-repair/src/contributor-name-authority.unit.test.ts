/**
 * Tests target-authoritative contributor identity extraction.
 *
 * Fixtures are invented and mirror archive attribution grammar only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { archiveContributorNameForms, } from '../dist/final/node/index.mjs';

await describe({
  name: archiveContributorNameForms.name,
  children: [
    it({
      name: 'READS PLAIN AND LINKED TARGET IDENTITIES without URL',
      fn: async () => {
        expect(archiveContributorNameForms({
          text: 'Contributors for this entry: One Among Us, Yumiao, [Kotori](https://example.test/kotori)',
        },),).toEqual([
          'One Among Us',
          'Yumiao',
          'Kotori',
        ],);
      },
    },),

    it({
      name: 'READS SINGULAR ATTRIBUTION CONTINUATION after label-only line',
      fn: async () => {
        expect(archiveContributorNameForms({
          text: 'Contributor for this entry:\n[Snow Cat](https://example.test/snow-cat)\n\nNext paragraph.',
        },),).toEqual(['Snow Cat',],);
      },
    },),

    it({
      name: 'KEEPS COMMA INSIDE PARENTHETICAL ROLE NOTE with identity',
      fn: async () => {
        expect(archiveContributorNameForms({
          text: 'Contributor for this entry: Mika (translation, review)',
        },),).toEqual(['Mika (translation, review)',],);
      },
    },),

    it({
      name: 'READS FULLWIDTH LABEL DELIMITER used by archive',
      fn: async () => {
        expect(archiveContributorNameForms({
          text: 'Contributor for this entry：Memorial Editor',
        },),).toEqual(['Memorial Editor',],);
      },
    },),

    it({
      name: 'IGNORES ORDINARY PROSE carrying same words away from line start',
      fn: async () => {
        expect(archiveContributorNameForms({
          text: 'The contributor for this entry shared a memory.',
        },),).toEqual([],);
      },
    },),
  ],
},);
