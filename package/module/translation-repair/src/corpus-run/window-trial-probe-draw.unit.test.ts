/**
 Tests for what one entry contributes to the window trial: its two pages read
 from a scripted corpus, prepared, screened, and the flagged slices drawn with
 their controls.

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
  drawEntry,
} from '../../dist/final/node/index.mjs';
import { capturingLoggerPair, } from '../capturing-logger.test-fixture.ts';
import { rejectionOf, } from './rejection-of.test-fixture.ts';
import {
  CAT_PIN,
  CLEAN_SOURCE,
  CLEAN_TARGET,
  FLAGGED_SOURCE,
  FLAGGED_TARGET,
} from './window-trial-probe-draw.test-fixture.ts';

/**
 Reader of a scripted corpus that records the paths it was asked for.

 @param pages - text of each path the corpus holds

 @param asked - array each path asked for lands in

 @returns Reader that answers a held path and refuses any other as git does

 @example
 ```ts
 const readPage = scriptedPages({ pages: new Map([['people/E/page.md', '猫',],],), asked: [], },);
 ```
 */
function scriptedPages(
  {
    pages,
    asked,
  }: {
    readonly pages: ReadonlyMap<string, string>;
    readonly asked: string[];
  },
): (input: { readonly pin: typeof CAT_PIN; readonly relPath: string; }) => Promise<string> {
  return function readPage(
    { relPath, }: { readonly pin: typeof CAT_PIN; readonly relPath: string; },
  ): Promise<string> {
    asked.push(relPath,);
    /**
     Text of the page, when the corpus holds it.
     */
    const held = pages.get(relPath,);
    if (held === undefined)
      return Promise.reject(new CorpusReadError({
        detail: `${relPath} at ${CAT_PIN.commitSha}`,
        cause: { stderr: `fatal: path '${relPath}' does not exist in '${CAT_PIN.commitSha}'`, },
      },),);
    return Promise.resolve(held,);
  };
}

await describe({
  name: drawEntry.name,
  children: [
    it({
      name: 'DRAWS the flagged slice and one control, with every prepared slice, and reads the two pages of the entry',
      fn: async () => {
        const asked: string[] = [];
        const { logger, } = capturingLoggerPair();

        /**
         What the entry contributes.
         */
        const drawn = await drawEntry({
          entryId: 'Mittens',
          pin: CAT_PIN,
          readPage: scriptedPages({
            pages: new Map([
              [
                'people/Mittens/page.md',
                FLAGGED_SOURCE,
              ],
              [
                'people/Mittens/page.en.md',
                FLAGGED_TARGET,
              ],
            ],),
            asked,
          },),
          l: logger,
        },);

        expect(drawn.picks,).toEqual([
          {
            entryId: 'Mittens',
            sliceIndex: 1,
            sliceClass: 'untranslated',
          },
          {
            entryId: 'Mittens',
            sliceIndex: 2,
            sliceClass: 'control-unflagged',
          },
        ],);
        expect(drawn.slices.length,).toBe(3,);
        expect(asked,).toEqual([
          'people/Mittens/page.md',
          'people/Mittens/page.en.md',
        ],);
      },
    },),
    it({
      name: 'DRAWS NO PICK from an entry the screen flags nothing in, and still returns its prepared slices',
      fn: async () => {
        const { logger, } = capturingLoggerPair();

        /**
         What the entry contributes.
         */
        const drawn = await drawEntry({
          entryId: 'Mittens',
          pin: CAT_PIN,
          readPage: scriptedPages({
            pages: new Map([
              [
                'people/Mittens/page.md',
                CLEAN_SOURCE,
              ],
              [
                'people/Mittens/page.en.md',
                CLEAN_TARGET,
              ],
            ],),
            asked: [],
          },),
          l: logger,
        },);

        expect(drawn.picks,).toEqual([],);
        expect(drawn.slices.length,).toBe(2,);
      },
    },),
    it({
      name: 'STEPS PAST an entry with one side, drawing nothing and logging the skip',
      fn: async () => {
        const { logger, lines, } = capturingLoggerPair();

        /**
         What the entry contributes.
         */
        const drawn = await drawEntry({
          entryId: 'Mittens',
          pin: CAT_PIN,
          readPage: scriptedPages({
            pages: new Map([
              [
                'people/Mittens/page.md',
                CLEAN_SOURCE,
              ],
            ],),
            asked: [],
          },),
          l: logger,
        },);

        expect(drawn,).toEqual({
          picks: [],
          slices: [],
        },);
        expect(lines,).toEqual([
          'Mittens: skipped, CorpusReadError: corpus read failed for people/Mittens/page.en.md at '
          + `${CAT_PIN.commitSha} (missing-object); check that the clone exists and the pinned commit is present.`,
        ],);
      },
    },),
    it({
      name: 'REJECTS with a corpus read that failed for any other reason, since a missing clone must not read as a missing page',
      fn: async () => {
        const { logger, lines, } = capturingLoggerPair();

        /**
         What the draw rejected with.
         */
        const refusal = await rejectionOf({
          promise: drawEntry({
            entryId: 'Mittens',
            pin: CAT_PIN,
            readPage: function unreadable(): Promise<string> {
              return Promise.reject(new CorpusReadError({
                detail: 'people/Mittens/page.md',
                cause: new Error('spawn failed',),
              },),);
            },
            l: logger,
          },),
        },);

        expect(refusal,).toBeInstanceOf(CorpusReadError,);
        expect(String(refusal,),).toBe(
          'CorpusReadError: corpus read failed for people/Mittens/page.md (other); '
          + 'check that the clone exists and the pinned commit is present.',
        );
        expect(lines,).toEqual([],);
      },
    },),
  ],
},);
