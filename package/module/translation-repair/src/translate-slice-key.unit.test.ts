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
    sourceText: '小猫在窗台上睡觉。\n',
    incumbentText: 'The cat sleeps on the windowsill.\n',
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
  ],
},);
