/**
 Tests for gathering the census over a list of corpus entries.

 The corpus is a throwaway git repository the cases build, and the settled
 recipes are scripted, so nothing reads the operator's corpus clone or runs
 directory.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  FrontMatterParseError,
  gatherSliceCensus,
  type SliceCensusRecipeReading,
} from '../../dist/final/node/index.mjs';
import {
  FIRST_SECTION_ONLY_TARGET,
  makeCensusCorpus,
  ONE_BLOCK_PLUS_ADDED_TARGET,
  ONE_BLOCK_SOURCE,
  THREE_SECTION_SOURCE,
  THREE_SECTION_TARGET,
  UNREADABLE_FRONT_MATTER_SOURCE,
} from './slice-census-corpus.test-fixture.ts';

/**
 A commit no repository holds.
 */
const NO_SUCH_COMMIT = '0'.repeat(40,);

/**
 Reading of an entry no artifact records.

 @returns The unsettled reading

 @example
 ```ts
 const reading = await unsettled();
 ```
 */
async function unsettled(): Promise<SliceCensusRecipeReading> {
  return { kind: 'unsettled', };
}

await describe({
  name: gatherSliceCensus.name,
  children: [
    it({
      name: 'GATHERS NOTHING for no entry and never reads a recipe',
      fn: async () => {
        await using corpus = await makeCensusCorpus({ files: { 'README.md': 'cats\n', }, },);

        /**
         Entries a recipe was read for.
         */
        const asked: string[] = [];
        expect(await gatherSliceCensus({
          pin: {
            cloneDir: corpus.cloneDir,
            commitSha: corpus.commitSha,
          },
          entryIds: [],
          readRecipe: async function readNone({ entryId, },): Promise<SliceCensusRecipeReading> {
            asked.push(entryId,);
            return await unsettled();
          },
        },),).toEqual({
          rows: [],
          incomplete: [],
          legacy: [],
        },);
        expect(asked,).toEqual([],);
      },
    },),
    it({
      name: 'MEASURES EACH ENTRY IN THE ORDER GIVEN, reading its recipe first, and sets aside the one lacking its '
        + 'original',
      fn: async () => {
        await using corpus = await makeCensusCorpus({
          files: {
            'people/mochi/page.md': THREE_SECTION_SOURCE,
            'people/mochi/page.en.md': THREE_SECTION_TARGET,
            'people/yuzu/page.en.md': THREE_SECTION_TARGET,
            'people/nori/page.md': THREE_SECTION_SOURCE,
            'people/nori/page.en.md': FIRST_SECTION_ONLY_TARGET,
          },
        },);

        /**
         Entries a recipe was read for.
         */
        const asked: string[] = [];

        /**
         What the gatherer made of the three entries.
         */
        const gathered = await gatherSliceCensus({
          pin: {
            cloneDir: corpus.cloneDir,
            commitSha: corpus.commitSha,
          },
          entryIds: [
            'nori',
            'yuzu',
            'mochi',
          ],
          readRecipe: async function readNone({ entryId, },): Promise<SliceCensusRecipeReading> {
            asked.push(entryId,);
            return await unsettled();
          },
        },);

        expect({
          asked,
          rowIds: gathered.rows.map(function idOf(row,): string {
            return row.entryId;
          },),
          carves: gathered.rows.map(function carveOf(row,): string {
            return row.carve;
          },),
          incomplete: gathered.incomplete,
          legacy: gathered.legacy,
        },).toEqual({
          asked: [
            'nori',
            'yuzu',
            'mochi',
          ],
          rowIds: [
            'nori',
            'mochi',
          ],
          carves: [
            'deterministic',
            'deterministic',
          ],
          incomplete: ['yuzu',],
          legacy: [],
        },);
      },
    },),
    it({
      name: 'NAMES A LEGACY ENTRY and still measures it at the run pin, and names a legacy entry that is also '
        + 'incomplete in both lists',
      fn: async () => {
        await using corpus = await makeCensusCorpus({
          files: {
            'people/mochi/page.md': THREE_SECTION_SOURCE,
            'people/mochi/page.en.md': THREE_SECTION_TARGET,
            'people/yuzu/page.en.md': THREE_SECTION_TARGET,
          },
        },);

        /**
         What the gatherer made of the two legacy entries.
         */
        const gathered = await gatherSliceCensus({
          pin: {
            cloneDir: corpus.cloneDir,
            commitSha: corpus.commitSha,
          },
          entryIds: [
            'mochi',
            'yuzu',
          ],
          readRecipe: async function readLegacy(): Promise<SliceCensusRecipeReading> {
            return { kind: 'legacy', };
          },
        },);

        expect({
          rowIds: gathered.rows.map(function idOf(row,): string {
            return row.entryId;
          },),
          incomplete: gathered.incomplete,
          legacy: gathered.legacy,
        },).toEqual({
          rowIds: ['mochi',],
          incomplete: ['yuzu',],
          legacy: [
            'mochi',
            'yuzu',
          ],
        },);
      },
    },),
    it({
      name: 'READS A SETTLED ENTRY AT THE COMMIT ITS ARTIFACT NAMES and carves it through the recorded recipe, '
        + 'while an unsettled entry is read at the run pin, which holds nothing here',
      fn: async () => {
        await using corpus = await makeCensusCorpus({
          files: {
            'people/mochi/page.md': ONE_BLOCK_SOURCE,
            'people/mochi/page.en.md': ONE_BLOCK_PLUS_ADDED_TARGET,
            'people/nori/page.md': ONE_BLOCK_SOURCE,
            'people/nori/page.en.md': ONE_BLOCK_PLUS_ADDED_TARGET,
          },
        },);

        /**
         What the gatherer made of the settled entry and the unsettled one,
         under a run pin whose commit holds neither.
         */
        const gathered = await gatherSliceCensus({
          pin: {
            cloneDir: corpus.cloneDir,
            commitSha: NO_SUCH_COMMIT,
          },
          entryIds: [
            'mochi',
            'nori',
          ],
          readRecipe: async function readMochiSettled({ entryId, },): Promise<SliceCensusRecipeReading> {
            if (entryId !== 'mochi')
              return await unsettled();
            return {
              kind: 'settled',
              corpusSha: corpus.commitSha,
              recipe: {
                blockPairings: new Map([[
                  0,
                  [
                    {
                      source: 0,
                      target: 0,
                    },
                    {
                      source: 1,
                      target: 1,
                    },
                  ],
                ],],),
                unrecorded: ['sectionPairing',],
              },
            };
          },
        },);

        expect(gathered.rows,).toEqual([
          {
            entryId: 'mochi',
            carve: 'settled-partial',
            pairingRefusal: '',
            sliceSourceChars: [24,],
            sliceTargetChars: [64,],
            unpairedSourceSections: 0,
            unpairedSourceChars: 0,
            unpairedTargetSections: 0,
            unpairedTargetChars: 0,
            targetOnlyBlocks: 1,
            targetOnlyChars: 44,
            targetOnlyBlockChars: [44,],
          },
        ],);
        expect({
          incomplete: gathered.incomplete,
          legacy: gathered.legacy,
        },).toEqual({
          incomplete: ['nori',],
          legacy: [],
        },);
      },
    },),
    it({
      name: 'LETS AN ENTRY WHOSE PAGE WILL NOT PARSE STOP THE CENSUS with the parser\'s own refusal, since only a '
        + 'missing side makes an entry incomplete',
      fn: async () => {
        await using corpus = await makeCensusCorpus({
          files: {
            'people/mochi/page.md': UNREADABLE_FRONT_MATTER_SOURCE,
            'people/mochi/page.en.md': THREE_SECTION_TARGET,
          },
        },);
        try {
          await gatherSliceCensus({
            pin: {
              cloneDir: corpus.cloneDir,
              commitSha: corpus.commitSha,
            },
            entryIds: ['mochi',],
            readRecipe: unsettled,
          },);
        }
        catch (error) {
          expect(error,).toBeInstanceOf(FrontMatterParseError,);
          expect(String(error,),).toBe(
            'FrontMatterParseError: Front matter fence pair found but YAML inside refused to parse at line 1 '
              + 'column 10 (BAD_INDENT); corpus metadata parses upstream, so this signals corruption.',
          );
          return;
        }
        throw new Error('the census went on past a page it could not parse',);
      },
    },),
  ],
},);
