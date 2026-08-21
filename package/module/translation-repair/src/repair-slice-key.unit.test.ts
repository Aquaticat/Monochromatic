/**
 * Tests for the repair lane's cache key.
 *
 * THE KEY HAS NO OTHER WITNESS. Persist and resume both call the same function,
 * so a change to how it is derived produces no failure anywhere: every run
 * simply misses the cache and buys every slice again, and the only symptom is
 * quota. The golden hash below is the witness, and it exists to fail when the
 * derivation moves without the version moving with it.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  DEFAULT_ADJUDICATION_CONFIG,
  prepareDocumentPair,
  repairRunShape,
  type RepairModels,
  repairSliceKey,
  SLICE_CACHE_VERSION,
} from '../dist/final/node/index.mjs';

/**
 * Rosters every case keys against.
 */
const MODELS: RepairModels = {
  criticModelIds: [
    'hf:moonshotai/Kimi-K3',
    'hf:zai-org/GLM-5.2',
  ],
  panelModelIds: ['hf:Qwen/Qwen3.8-27B',],
  editorModelIds: ['hf:openai/gpt-oss-120b',],
  judgeModelIds: ['hf:zai-org/GLM-4.7-Flash',],
  refinerModelIds: ['hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',],
  checkerModelIds: ['hf:Qwen/Qwen3.8-27B',],
};

/**
 * Slice these cases key.
 */
const SLICE = {
  sourceText: '猫猫在窗台上打盹。',
  targetText: 'The cat naps on the sill.',
  lineStructured: false,
};

/**
 * Keys the fixture slice under a run shape.
 *
 * @param runShape - what a run asks
 *
 * @returns Key for the fixture slice
 *
 * @example
 * ```ts
 * const key = keyed({ runShape, },);
 * ```
 */
function keyed({ runShape, }: { readonly runShape: string; },): string {
  return repairSliceKey({
    runShape,
    ...SLICE,
  },);
}

await describe({
  name: repairSliceKey.name,
  children: [
    it({
      name:
        'produces a KNOWN hash for known inputs, which is the only thing standing between a change '
        + 'to this derivation and every settled slice in the corpus silently missing the cache. '
        + 'A DERIVATION change moves this hash and needs SLICE_CACHE_VERSION moved with it; a '
        + 'change to the FIXTURE INPUTS below moves it too, and must not, because those inputs are '
        + 'already part of the key and invalidate their own entries',
      fn: async () => {
        expect(SLICE_CACHE_VERSION,).toBe(29,);

        // MOVED THREE TIMES ON 2026-08-20, FOR THREE DIFFERENT REASONS, which
        // is the whole point of keeping the note.
        //
        // First the fixture roster was renamed when the provider replaced one
        // model: the INPUT moved and the derivation did not, so no version moved
        // with it. Real entries on disk carry the old roster inside their own
        // key and stop matching on their own, while a bump would additionally
        // discard every entry whose roster never changed, which is a corpus of
        // work thrown away for nothing.
        //
        // Then the declared-name guard reached this lane's acceptance, and that
        // one DID need version 28: the declarations already ride in the run
        // shape, so a slice settled before the guard existed keys identically to
        // one settled after and would resume with its refusal never asked.
        //
        // Then version 29, for a change to the RECORD rather than to the
        // question: the outcome grew `rounds` and an unconditional
        // `droppedDeclaredNames`. A version-28 record fails the loader's own
        // shape check and is recomputed regardless, so the bump buys nothing at
        // runtime; it is here so one version number never names two record
        // shapes, which is what this file's versioning exists to prevent.
        expect(keyed({ runShape: repairRunShape({ models: MODELS, },), },),)
          .toBe('abd8d50302804d0978347ce2ff3ce63e617140be86d727a73559c53ecc5b41f9',);
      },
    },),
    it({
      name:
        'moves the key for every input a resumed slice would be wrong about: the roster, the '
        + 'thresholds, the declared names, either text, and the line-structure verdict the '
        + 'enclosing chunk carries',
      fn: async () => {
        /**
         * Key under the unchanged fixture.
         */
        const settled = keyed({ runShape: repairRunShape({ models: MODELS, },), },);
        expect(keyed({
          runShape: repairRunShape({
            models: {
              ...MODELS,
              criticModelIds: ['hf:moonshotai/Kimi-K3',],
            },
          },),
        },),).not
          .toBe(settled,);
        expect(keyed({
          runShape: repairRunShape({
            models: MODELS,
            adjudicationConfig: DEFAULT_ADJUDICATION_CONFIG,
          },),
        },),).not
          .toBe(settled,);
        expect(keyed({
          runShape: repairRunShape({
            models: MODELS,
            identityContext: 'Name: Whiskers',
          },),
        },),).not
          .toBe(settled,);

        /**
         * Same run, each slice field moved in turn.
         */
        const runShape = repairRunShape({ models: MODELS, },);
        for (const moved of [
          { sourceText: '猫猫在窗台上睡觉。', },
          { targetText: 'The cat sleeps on the sill.', },
          { lineStructured: true, },
        ]) {
          expect(repairSliceKey({
            runShape,
            ...SLICE,
            ...moved,
          },),).not
            .toBe(settled,);
        }
      },
    },),
    it({
      name:
        'is the same key for the same text WHEREVER the slice sits, which is the point of version 26. '
        + 'The index used to be in here, so inserting one slice at the top of a document discarded '
        + 'every slice below it however untouched its text, and one-sided slicing inserts a slice for '
        + 'every untranslated section',
      fn: async () => {
        /**
         * Document whose two sections are byte-identical on both sides, which is
         * the only shape where two slices of one document can share a key. The
         * pinned corpus contains none, so it is invented here rather than
         * assumed away.
         */
        const prepared = prepareDocumentPair({
          sourceText: '## 甲\n\n猫猫喜欢晒太阳。\n\n## 甲\n\n猫猫喜欢晒太阳。\n',
          targetText: '## A\n\nThe cat likes the sun.\n\n## A\n\nThe cat likes the sun.\n',
        },);
        expect(prepared.slices,).toHaveLength(2,);

        /**
         * Run shape both keys are taken under.
         */
        const runShape = repairRunShape({ models: MODELS, },);

        /**
         * Both slices keyed exactly as the driver keys them.
         */
        const keys = prepared.slices
          .map(function toKey(slice,): string {
            return repairSliceKey({
              runShape,
              sourceText: slice.source
                .text,
              targetText: slice.target
                .text,
              lineStructured: prepared.lineStructuredSliceIndices
                .has(slice.target
                  .chunkIndex,),
            },);
          },);
        expect(prepared.slices
          .map(function toIndex(slice,): number {
            return slice.target
              .chunkIndex;
          },),).toEqual([
          0,
          1,
        ],);
        expect(keys[0],).toBe(keys[1],);
      },
    },),
  ],
},);
