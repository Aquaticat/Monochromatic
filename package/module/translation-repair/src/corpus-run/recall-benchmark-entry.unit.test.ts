/**
 Tests for seeding one corpus entry for the recall benchmark, read against a
 throwaway clone holding invented cat pages, never the pinned corpus.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  CorpusReadError,
  FrontMatterParseError,
  seedRecallEntry,
} from '../../dist/final/node/index.mjs';
import { rejectionOf, } from '../rejecting-call.test-fixture.ts';
import { benchWorld, } from './bench-world.test-fixture.ts';

/**
 First sentence of the invented English page, long enough to be seeded.
 */
const DOZING = 'The kitten dozes on the warm windowsill every sunny afternoon.';

/**
 Second sentence of the invented English page, long enough to be seeded.
 */
const TAIL = 'Its tail hangs down to the floor beside the cushion basket.';

/**
 English page holding both sentences.
 */
const ENGLISH = `${DOZING} ${TAIL}\n`;

/**
 Original page well under the small band's cut.
 */
const SMALL_SOURCE = '小猫在窗台上打盹。\n';

await describe({
  name: seedRecallEntry.name,
  concurrency: 1,
  children: [
    it({
      name: 'SEEDS an entry with every sentence long enough, longest first, and places it in the small band',
      fn: async () => {
        await using world = await benchWorld({
          entries: {
            mittens: {
              source: SMALL_SOURCE,
              english: ENGLISH,
            },
          },
        },);

        const outcome = await seedRecallEntry({
          id: 'mittens',
          sizer: new TextEncoder(),
          pin: world.pin,
        },);

        expect(outcome,).toEqual({
          kind: 'seeded',
          band: 'small',
          entry: {
            entryId: 'mittens',
            sourceText: SMALL_SOURCE,
            targetText: ENGLISH,
            seeds: [
              {
                id: 'seed/omission-0',
                category: 'accuracy/omission',
                kind: 'deletion',
                needle: DOZING,
                replacement: '',
              },
              {
                id: 'seed/omission-1',
                category: 'accuracy/omission',
                kind: 'deletion',
                needle: TAIL,
                replacement: '',
              },
            ],
          },
        },);
      },
    },),

    it({
      name: 'PLACES entries in the medium and large bands by the byte size of the original page',
      fn: async () => {
        await using world = await benchWorld({
          entries: {
            midsize: {
              source: '猫'.repeat(800,),
              english: ENGLISH,
            },
            bigcat: {
              source: '猫'.repeat(1_300,),
              english: ENGLISH,
            },
          },
        },);

        const sizer = new TextEncoder();
        const midsize = await seedRecallEntry({
          id: 'midsize',
          sizer,
          pin: world.pin,
        },);
        const bigcat = await seedRecallEntry({
          id: 'bigcat',
          sizer,
          pin: world.pin,
        },);

        expect([
          midsize.kind === 'seeded' ? midsize.band : midsize.reason,
          bigcat.kind === 'seeded' ? bigcat.band : bigcat.reason,
        ],).toEqual([
          'medium',
          'large',
        ],);
      },
    },),

    it({
      name: 'SETS ASIDE an entry whose English page holds no sentence long enough to delete, saying so',
      fn: async () => {
        await using world = await benchWorld({
          entries: {
            meowing: {
              source: SMALL_SOURCE,
              english: 'Meow.\n',
            },
          },
        },);

        const outcome = await seedRecallEntry({
          id: 'meowing',
          sizer: new TextEncoder(),
          pin: world.pin,
        },);

        expect(outcome,).toEqual({
          kind: 'skipped',
          reason: 'no seedable sentence',
        },);
      },
    },),

    it({
      name: 'SETS ASIDE an entry that has an original page and no English page, saying it is an incomplete pair',
      fn: async () => {
        await using world = await benchWorld({
          entries: {},
          originalOnly: { napping: SMALL_SOURCE, },
        },);

        const outcome = await seedRecallEntry({
          id: 'napping',
          sizer: new TextEncoder(),
          pin: world.pin,
        },);

        expect(outcome,).toEqual({
          kind: 'skipped',
          reason: 'incomplete pair',
        },);
      },
    },),

    it({
      name: 'REFUSES a clone that cannot be read instead of setting the entry aside',
      fn: async () => {
        await using world = await benchWorld({ entries: {}, },);

        const refusal = await rejectionOf(async function readAbsentClone(): Promise<unknown> {
          return await seedRecallEntry({
            id: 'purring',
            sizer: new TextEncoder(),
            pin: {
              cloneDir: `${world.pin.cloneDir}-absent`,
              commitSha: world.pin.commitSha,
            },
          },);
        },);

        expect(refusal,).toBeInstanceOf(CorpusReadError,);
        expect(String(refusal,),).toBe(
          `CorpusReadError: corpus read failed for ${world.pin.commitSha}:people/purring/page.md (other); `
            + 'check that the clone exists and the pinned commit is present.',
        );
      },
    },),

    it({
      name: 'REFUSES an English page whose front matter will not parse instead of setting the entry aside',
      fn: async () => {
        await using world = await benchWorld({
          entries: {
            tangled: {
              source: SMALL_SOURCE,
              english: `---\ntitle: [unclosed\n---\n${DOZING}\n`,
            },
          },
        },);

        const refusal = await rejectionOf(async function readTangled(): Promise<unknown> {
          return await seedRecallEntry({
            id: 'tangled',
            sizer: new TextEncoder(),
            pin: world.pin,
          },);
        },);

        expect(refusal,).toBeInstanceOf(FrontMatterParseError,);
        expect(String(refusal,),).toBe(
          'FrontMatterParseError: Front matter fence pair found but YAML inside refused to parse at line 1 column 17 '
            + '(BAD_INDENT); corpus metadata parses upstream, so this signals corruption.',
        );
      },
    },),
  ],
},);
