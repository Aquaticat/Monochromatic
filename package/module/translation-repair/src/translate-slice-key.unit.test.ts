/**
 * Tests for the cross-run key that decides when two runs are looking at the same
 * slice.
 *
 * WHAT THESE PIN is the pair of promises the key has to keep at once. It must
 * SEPARATE two questions that can have different answers, or one arm of a
 * comparison reads the other's cached result and the two report as identical.
 * And it must not separate anything else, or a settled corpus is discarded for
 * nothing.
 *
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  translateRunShape,
  translateSliceKey,
} from '../dist/final/node/index.mjs';

/**
 * Roster both sides of every comparison share.
 */
const MODELS = {
  translatorModelIds: ['hf:cat/Cat-A',
    'hf:cat/Cat-B',] as never,
  judgeModelIds: ['hf:cat/Cat-A',
    'hf:cat/Cat-B',
    'hf:cat/Cat-C',] as never,
};

/**
 * Run shape every case keys against.
 */
const RUN_SHAPE = translateRunShape({ models: MODELS, },);

/**
 * Slice original every case keys.
 */
const SOURCE_TEXT = '小猫在窗台上睡觉。\n';

/**
 * Translation already sitting in the archive for it.
 */
const INCUMBENT_TEXT = 'The cat sleeps on the windowsill.\n';

/**
 * Key a windowless slice hashes to, pinned rather than recomputed.
 *
 * WHY A LITERAL RATHER THAN A COMPARISON. Every other case here asks whether two
 * keys agree, and a change that moved BOTH sides would pass all of them while
 * discarding every settled slice in the pinned corpus, since a resumed record is
 * found by this exact string. Only a value written down outside the code catches
 * that. It moves when {@link TRANSLATE_SLICE_CACHE_VERSION} moves, which is the
 * intended signal: a bump means the corpus is deliberately being rebought.
 *
 * The roster feeding {@link RUN_SHAPE} is invented, so a production roster change
 * leaves this alone.
 */
const LEGACY_WINDOWLESS_KEY = '37607f7cf4e5405941311a0f6f4dcb2522c9aec9b868a24a27fefdee801cb6ca';

/**
 * One slice's key, with whatever this case wants to vary.
 *
 * @param neighbouringSourceText - wider window, absent for an ordinary run
 *
 * @returns Key for that slice under that window
 *
 * @example
 * ```ts
 * const key = keyFor({},);
 * ```
 */
function keyFor(
  { neighbouringSourceText, }: { readonly neighbouringSourceText?: string; },
): string {
  return translateSliceKey({
    runShape: RUN_SHAPE,
    sourceText: SOURCE_TEXT,
    incumbentText: INCUMBENT_TEXT,
    incumbentKind: 'present',
    lineStructured: false,
    ...((neighbouringSourceText === undefined)
      ? {}
      : { neighbouringSourceText, }),
  },);
}

await describe({
  name: translateSliceKey.name,
  children: [
    it({
      name: 'SEPARATES a slice judged with the neighbouring original from the same slice judged '
        + 'without it, which is what stops the two arms of `#108` sharing a cached answer and '
        + 'reporting a window change as having made no difference',
      fn: async () => {
        expect(keyFor({ neighbouringSourceText: '她看着外面的鸟。\n', },),)
          .not
          .toBe(keyFor({},),);
      },
    },),
    it({
      name: 'gives an ABSENT window and an EMPTY one the same key, so a caller that computes the '
        + 'neighbours of a lone slice and gets nothing does not discard the entry a caller that '
        + 'never asked would have used',
      fn: async () => {
        expect(keyFor({ neighbouringSourceText: '', },),).toBe(keyFor({},),);
      },
    },),
    it({
      name: 'separates two DIFFERENT windows, since a judge shown one neighbour can answer '
        + 'differently from one shown another',
      fn: async () => {
        expect(keyFor({ neighbouringSourceText: '她看着外面的鸟。\n', },),)
          .not
          .toBe(keyFor({ neighbouringSourceText: '傍晚她回到炉火旁。\n', },),);
      },
    },),
    it({
      name: 'keys the same slice to the same string when nothing varies, which is the whole point '
        + 'of the key and the thing every separation above is measured against',
      fn: async () => {
        expect(keyFor({},),).toBe(keyFor({},),);
      },
    },),
    it({
      name: 'treats an EXPLICITLY passed `undefined` as absence, reaching the function rather than '
        + 'being stripped by a caller: every other case here goes through a helper that removes '
        + 'the property, so without this one nothing tests what the function does with it',
      fn: async () => {
        /**
         * Argument a JavaScript caller can build and TypeScript refuses.
         *
         * `exactOptionalPropertyTypes` rejects this property as `undefined`,
         * which is a real guard and is why the cast is here rather than the
         * type being loosened to admit it. What the guard does not reach is an
         * untyped caller, a spread of a partly filled record, or a wrapper
         * compiled before this property existed, and each of those hands the
         * function exactly this object. What it does with it is the runtime
         * behaviour under test.
         */
        const explicitlyAbsent = {
          runShape: RUN_SHAPE,
          sourceText: SOURCE_TEXT,
          incumbentText: INCUMBENT_TEXT,
          incumbentKind: 'present',
          lineStructured: false,
          neighbouringSourceText: undefined,
        } as unknown as Parameters<typeof translateSliceKey>[0];

        expect(translateSliceKey(explicitlyAbsent,),).toBe(keyFor({},),);
      },
    },),
    it({
      name: 'HASHES A WINDOWLESS SLICE TO A PINNED STRING, which is what stands between a change '
        + 'to this serialization and the silent rebuying of every settled slice in the corpus. '
        + 'A deliberate cache-version bump moves this value and should; an accidental one is what '
        + 'this catches',
      fn: async () => {
        expect(keyFor({},),).toBe(LEGACY_WINDOWLESS_KEY,);
      },
    },),
  ],
},);
