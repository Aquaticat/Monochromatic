/**
 Tests target-authoritative contributor identity extraction, and the
 declaring lines it reads (ledger B81).

 Fixtures mirror archive attribution grammar only. Cat-themed invention
 throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  archiveContributorNameForms,
  contributorDeclarationLines,
} from '../dist/final/node/index.mjs';

await describe({
  name: 'contributor name authority',
  children: [
    describe({
      name: archiveContributorNameForms.name,
      children: [
        it({
          name: 'READS PLAIN AND LINKED TARGET IDENTITIES without URL',
          fn: async () => {
            expect(archiveContributorNameForms({
              text: 'Contributors for this entry: The Cat Archive, Whisker, [Pebble](https://example.test/pebble)',
            },),).toEqual([
              'The Cat Archive',
              'Whisker',
              'Pebble',
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
              text: 'Contributor for this entry: Pumpkin (translation, review)',
            },),).toEqual(['Pumpkin (translation, review)',],);
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
    },),

    describe({
      name: contributorDeclarationLines.name,
      children: [
        it({
          name: 'NAMES EACH DECLARING LINE: a label line with its names, a label standing alone with nothing, and '
            + 'each line continuing it up to the first blank one',
          fn: async () => {
            expect(contributorDeclarationLines({
              text: 'Contributor for this entry: Mittens\n'
                + 'Contributors for this entry:\n'
                + '[Snow Cat](https://example.test/snow-cat)\n'
                + 'Biscuit\n'
                + '\n'
                + 'The cats napped.',
            },),).toEqual([
              {
                line: 0,
                names: 'Mittens',
              },
              {
                line: 1,
                names: '',
              },
              {
                line: 2,
                names: '[Snow Cat](https://example.test/snow-cat)',
              },
              {
                line: 3,
                names: 'Biscuit',
              },
            ],);
          },
        },),

        it({
          name: 'DECLARES NOTHING for a line that does not open with a label, nor for the line after a label '
            + 'line that carries its own names',
          fn: async () => {
            expect(contributorDeclarationLines({
              text: 'The contributor for this entry shared a memory.\n'
                + 'Contributor for this entry：Pebble\n'
                + 'The cat won an award in spring.',
            },),).toEqual([{
              line: 1,
              names: 'Pebble',
            },],);
          },
        },),
      ],
    },),
  ],
},);
