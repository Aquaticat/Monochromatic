/**
 * Tests for the refusal that stops a winning repair dropping a declared name.
 *
 * WHAT THIS EXISTS TO CATCH. The repair lane's editor judges were shown two
 * candidates differing only in a declared alias and chose the one that dropped
 * it, six judges out of six, each reasoning that the alias had no basis in the
 * original. The lane records no ballots, so nothing about that decision reaches
 * a settled artifact and no reader could have found it. The refusal is
 * therefore deterministic, and this file proves the settlement CONSULTS it: a
 * guard computed and not consulted looks exactly like a guard that passed.
 *
 * IT ALSO PINS WHICH VERDICT MOVES. `patchSelected` says the patch beat the
 * archive on the measurements, and that stays true through a refusal, because
 * it did. Only the text that ships changes. Collapsing the two would make a
 * refusal indistinguishable from the case this file's subject already owns, a
 * patch that wins selection and whose envelope operations write no byte.
 *
 * A GUARD PROVES NOTHING UNTIL SHOWN TO FAIL, so the cases come in threes: a
 * winning patch accepted, the same shape of patch refused for dropping a
 * declared name, and that same dropping patch accepted once nothing is
 * declared.
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
  type ChunkVerdict,
  settleChunkVerdict,
} from '../dist/final/node/index.mjs';

/**
 * Slice these verdicts are settled for.
 */
const CHUNK_INDEX = 4;

/**
 * Name the archive's front matter declares.
 */
const DECLARED_NAME = 'Meowmeow';

/**
 * Alias it declares beside that, which is the form real judges removed.
 */
const DECLARED_ALIAS = 'Dumpling';

/**
 * Forms the archive declares for this person.
 */
const DECLARED_NAMES: readonly string[] = [
  DECLARED_NAME,
  DECLARED_ALIAS,
];

/**
 * Archive wording of the slice, carrying both declared forms.
 */
const INCUMBENT_TEXT =
  'Meowmeow, who everyone called Dumpling, kept the windowsill warm through that whole winter.';

/**
 * Repair that fixes the accuracy complaint and keeps both forms.
 */
const KEEPS_EVERY_NAME =
  'Meowmeow, who everyone called Dumpling, kept the windowsill warm all that winter.';

/**
 * Repair that fixes the same complaint and quietly drops the alias.
 */
const DROPS_THE_ALIAS = 'Meowmeow kept the windowsill warm all that winter.';

/**
 * Measurements of a patch that beat the archive.
 *
 * ONE RESOLVED ISSUE AND NOTHING WORSE is the smallest shape that wins
 * selection outright, so a case using it is testing the refusal rather than the
 * ranking.
 */
const WINNING_MEASUREMENTS = {
  integrityOk: true,
  resolvedHighSeverity: 1,
  resolvedTotal: 1,
  regressedKnownIssues: 0,
  touchedRegionChars: INCUMBENT_TEXT.length,
};

/**
 * Measurements of a patch that lost: it resolved nothing and broke the
 * document.
 */
const LOSING_MEASUREMENTS = {
  integrityOk: false,
  resolvedHighSeverity: 0,
  resolvedTotal: 0,
  regressedKnownIssues: 1,
  touchedRegionChars: INCUMBENT_TEXT.length,
};

/**
 * Settles one slice with a given patch and declaration list.
 *
 * @param patchedText - wording the editor produced
 *
 * @param declaredNames - forms preparation found in the front matter
 *
 * @param measurements - what the checks made of that patch
 *
 * @returns Verdict the lane settled on
 *
 * @example
 * ```ts
 * const verdict = settleWith({ patchedText: DROPS_THE_ALIAS, declaredNames: DECLARED_NAMES, },);
 * ```
 */
function settleWith(
  {
    patchedText,
    declaredNames,
    measurements = WINNING_MEASUREMENTS,
  }: {
    readonly patchedText: string;
    readonly declaredNames: readonly string[];
    readonly measurements?: typeof WINNING_MEASUREMENTS;
  },
): ChunkVerdict {
  return settleChunkVerdict({
    chunkIndex: CHUNK_INDEX,
    incumbentText: INCUMBENT_TEXT,
    patchedText,
    measurements,
    declaredNames,
  },);
}

await describe({
  name: settleChunkVerdict.name,
  children: [
    it({
      name: 'POSITIVE CONTROL: ACCEPTS a winning patch that keeps every declared form, so a later '
        + 'assertion that some settlement kept the archive text is reading a refusal rather than a '
        + 'patch that simply lost',
      fn: async () => {
        const verdict = settleWith({
          patchedText: KEEPS_EVERY_NAME,
          declaredNames: DECLARED_NAMES,
        },);
        expect(verdict.repairedText,).toBe(KEEPS_EVERY_NAME,);
        expect(verdict.patchSelected,).toBe(true,);
        expect(verdict.changed,).toBe(true,);
        expect(verdict.droppedDeclaredNames,).toEqual([],);
      },
    },),
    it({
      name: 'REFUSES a winning patch that drops a declared form, shipping the archive text and '
        + 'naming what would have gone, which is the decision no judge on this roster made unaided',
      fn: async () => {
        const verdict = settleWith({
          patchedText: DROPS_THE_ALIAS,
          declaredNames: DECLARED_NAMES,
        },);
        expect(verdict.repairedText,).toBe(INCUMBENT_TEXT,);
        expect(verdict.changed,).toBe(false,);
        expect(verdict.droppedDeclaredNames,).toEqual([DECLARED_ALIAS,],);
      },
    },),
    it({
      name: 'KEEPS reporting that the patch beat the archive on the measurements, since it did and '
        + 'a refusal nobody can see the cost of is a refusal nobody can audit',
      fn: async () => {
        const verdict = settleWith({
          patchedText: DROPS_THE_ALIAS,
          declaredNames: DECLARED_NAMES,
        },);
        expect(verdict.patchSelected,).toBe(true,);
      },
    },),
    it({
      name: 'ACCEPTS that same dropping patch when the archive declares nothing, so the refusal is '
        + 'attributable to the declared list and not to anything else about that wording',
      fn: async () => {
        const verdict = settleWith({
          patchedText: DROPS_THE_ALIAS,
          declaredNames: [],
        },);
        expect(verdict.repairedText,).toBe(DROPS_THE_ALIAS,);
        expect(verdict.changed,).toBe(true,);
      },
    },),
    it({
      name: 'ASKS NOTHING of a patch the archive already beat, since a slice nobody is replacing '
        + 'needs no permission to stay as it is and a refusal there would name a protection that '
        + 'protected nothing',
      fn: async () => {
        const verdict = settleWith({
          patchedText: DROPS_THE_ALIAS,
          declaredNames: DECLARED_NAMES,
          measurements: LOSING_MEASUREMENTS,
        },);
        expect(verdict.repairedText,).toBe(INCUMBENT_TEXT,);
        expect(verdict.patchSelected,).toBe(false,);
        expect(verdict.droppedDeclaredNames,).toEqual([],);
      },
    },),
  ],
},);
