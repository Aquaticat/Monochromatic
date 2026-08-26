/**
 * Tests for the assembly's withdrawn and shipped index sets.
 *
 * A replacement can validate on its own and still break a relation between
 * slices: a footnote reference settled apart from its definition. The guard
 * withdraws it at assembly, and the two index sets the result carries must say
 * so: the slice is withdrawn, not changed, and the document that ships is the
 * archive.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assembleTranslation,
  prepareDocumentPair,
  type TranslateSliceRecord,
} from '../dist/final/node/index.mjs';

/**
 * Original with a footnote referenced in one section and defined at the end.
 */
const SOURCE_TEXT = `## 甲

猫猫在窗台上睡觉[^1]。

## 乙

胡须酱追着蝴蝶跑。

[^1]: 它最喜欢的地方。
`;

/**
 * Archive with the same footnote.
 */
const TARGET_TEXT = `## Alpha

The cat sleeps on the windowsill[^1].

## Beta

Whiskers chases butterflies.

[^1]: The spot it likes best.
`;

/**
 * Wording of the referencing slice with its marker dropped.
 */
const DROPS_THE_MARKER = 'The cat sleeps on the windowsill.';

/**
 * Record for one slice, changed or kept.
 *
 * @param sliceIndex - slice this settles
 *
 * @param incumbentText - archive wording of the slice
 *
 * @param outputText - wording the lane settled on
 *
 * @returns Record as the lane writes it
 *
 * @example
 * ```ts
 * const record = recordFor({ sliceIndex: 0, incumbentText, outputText: incumbentText, },);
 * ```
 */
function recordFor(
  {
    sliceIndex,
    incumbentText,
    outputText,
  }: {
    readonly sliceIndex: number;
    readonly incumbentText: string;
    readonly outputText: string;
  },
): TranslateSliceRecord {
  return {
    kind: 'translate-slice',
    schemaVersion: 1,
    sliceIndex,
    outputText,
    changed: outputText !== incumbentText,
    disposition: 'stage-result',
    findings: [],
    droppedDeclaredNames: [],
    alignment: {
      kind: 'incumbent-dominates-source',
      sourceCodePoints: 11,
      incumbentCodePoints: 33,
      minProtectedIncumbent: 20,
      maxRatio: 2,
    },
    stageResult: {
      text: outputText,
      origin: 'fresh',
      decision: 'judged',
      voteWeight: 1,
      ballots: [],
      heardTranslators: 2,
      candidateCount: 2,
      slate: [],
      perCandidate: [],
      findings: [],
    },
  } as unknown as TranslateSliceRecord;
}

/**
 * Logger that keeps what it is told.
 *
 * @param said - lines kept
 *
 * @returns Logger writing into `said`
 *
 * @example
 * ```ts
 * const l = capturingLogger({ said: [], },);
 * ```
 */
function capturingLogger({ said, }: { readonly said: string[]; },): Logger {
  /**
   * Keeps one line.
   *
   * @param message - line to keep
   */
  const keep = (message: string,): void => {
    said.push(message,);
  };
  return {
    debug: keep,
    error: keep,
    fatal: keep,
    flush: async () => undefined,
    info: keep,
    trace: keep,
    warn: keep,
  };
}

await describe({
  name: assembleTranslation.name,
  children: [
    it({
      name: 'WITHDRAWS a replacement that drops a footnote marker at assembly and lists it as withdrawn, not '
        + 'changed, so the document that ships is the archive and the index sets say why',
      fn: async () => {
        /**
         * Prepared pair, sliced by the pipeline.
         */
        const prepared = await prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);

        /**
         * Slice carrying the reference, which the replacement damages.
         */
        const referencing = prepared.slices.find(function carriesMarker(slice,): boolean {
          return slice.target.text.includes('[^1].',);
        },);
        if (referencing === undefined)
          throw new Error('the fixture pair carries no slice with the reference',);

        /**
         * Lines the assembly wrote.
         */
        const said: string[] = [];

        const result = assembleTranslation({
          prepared,
          settled: prepared.slices.map(function toRecord(slice,): TranslateSliceRecord {
            return recordFor({
              sliceIndex: slice.target.sliceIndex,
              incumbentText: slice.target.text,
              outputText: (slice.target.sliceIndex === referencing.target.sliceIndex)
                ? DROPS_THE_MARKER
                : slice.target.text,
            },);
          },),
          unfilled: [],
          resumedSliceCount: 0,
          findings: [],
          l: capturingLogger({ said, },),
        },);

        expect(result.withdrawnSliceIndices,).toEqual([referencing.target.sliceIndex,],);
        expect(result.changedSliceIndices,).toEqual([],);
        expect(said.some(function mentionsWithdrawal(line,): boolean {
          return line.includes('withdrew 1 replacements at assembly',);
        },),).toBe(true,);
      },
    },),
  ],
},);
