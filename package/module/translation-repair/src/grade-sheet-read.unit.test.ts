/**
 * Tests for reading a filled grading sheet, and for scoring a blind pre-grade
 * against it.
 *
 * The fixture shapes are taken from the two sheets a human has actually graded,
 * which differ from each other and from anything specified: bracketed and
 * unbracketed answers, a verdict letter followed by prose, and answers that are
 * not verdicts at all. The prose itself is cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type GradedItem,
  parseGradedSheet,
  scoreGradeAgreement,
  scoreGradedPrecision,
} from '../dist/final/neutral/index.mjs';

/**
 * Legend every graded line carries, which bounds the grader's answer.
 */
const LEGEND = '  (Y = real defect · N = false positive)';

/**
 * Builds a sheet from raw grade answers, one item per answer.
 *
 * @param answers - text each grader answer carries, in sheet order
 *
 * @returns Sheet text the parser reads
 *
 * @example
 * ```ts
 * const sheet = catSheet({ answers: ['[Y]', 'N',], },);
 * ```
 */
function catSheet(
  { answers, }: { readonly answers: readonly string[]; },
): string {
  return [
    '# Milestone 3 precision grading sheet',
    '',
    '---',
    '',
    ...answers.flatMap(function toItem(
      answer,
      position,
    ) {
      return [
        `### ${String(position + 1,)}. grade: ${answer}${LEGEND}`,
        '- entry: Kitten · band: medium',
        '',
      ];
    },),
  ].join('\n',);
}

/**
 * Builds pre-grades for positions one upward.
 *
 * @param verdicts - verdict per position, in sheet order
 *
 * @returns Pre-graded items
 *
 * @example
 * ```ts
 * const agent = catPreGrades({ verdicts: ['real-defect',], },);
 * ```
 */
function catPreGrades(
  { verdicts, }: { readonly verdicts: readonly GradedItem['verdict'][]; },
): readonly GradedItem[] {
  return verdicts.map(function toItem(
    verdict,
    position,
  ): GradedItem {
    return {
      index: position + 1,
      verdict,
      note: '',
    };
  },);
}

await describe({
  name: parseGradedSheet.name,
  children: [
    it({
      name: 'reads the bracketed form one round used and the bare form the '
        + 'other did, since both are how a human has really filled a sheet',
      fn: async () => {
        const items = parseGradedSheet({
          text: catSheet({
            answers: [
              '[Y]',
              'Y',
              '[N]',
              'N',
            ],
          },),
        },);
        expect(items.map(function toVerdict(item,) {
          return item.verdict;
        },),).toEqual([
          'real-defect',
          'real-defect',
          'false-positive',
          'false-positive',
        ],);
        expect(items.map(function toIndex(item,) {
          return item.index;
        },),).toEqual([
          1,
          2,
          3,
          4,
        ],);
      },
    },),

    it({
      name: 'keeps the rationale a grader wrote after the verdict, which '
        + 'nothing else in the run reproduces',
      fn: async () => {
        const items = parseGradedSheet({
          text: catSheet({
            answers: [
              '[Y, but the warmer word would be "naps"]',
              'N. The original does quote the purr.',
            ],
          },),
        },);
        expect(items[0]?.verdict,).toBe('real-defect',);
        expect(items[0]?.note,).toBe('but the warmer word would be "naps"',);
        expect(items[1]?.verdict,).toBe('false-positive',);
        expect(items[1]?.note,).toBe('The original does quote the purr.',);
      },
    },),

    it({
      name: 'does NOT read an answer beginning with a verdict letter mid-word '
        + 'as that verdict, which is exactly how "Not enough context to grade" '
        + 'would otherwise become a false positive',
      fn: async () => {
        const items = parseGradedSheet({
          text: catSheet({
            answers: [
              '[Not enough context to grade]',
              '[Not sure which tense fits a cat]',
              '[Yesterday I would have said otherwise]',
            ],
          },),
        },);
        expect(items.map(function toVerdict(item,) {
          return item.verdict;
        },),).toEqual([
          'unscored',
          'unscored',
          'unscored',
        ],);
        expect(items[0]?.note,).toBe('Not enough context to grade',);
      },
    },),

    it({
      name: 'reads an untouched box as unscored rather than as a verdict',
      fn: async () => {
        const items = parseGradedSheet({ text: catSheet({ answers: ['[ ]',], },), },);
        expect(items[0]?.verdict,).toBe('unscored',);
        expect(items[0]?.note,).toBe('',);
      },
    },),

    it({
      name: 'bounds the answer at the legend even when the rationale quotes '
        + 'the legend\'s own wording',
      fn: async () => {
        const items = parseGradedSheet({
          text: catSheet({
            answers: ['[N, this reads to me like (Y = real defect) but it is not]',],
          },),
        },);
        expect(items[0]?.verdict,).toBe('false-positive',);
        expect(items[0]?.note,).toBe('this reads to me like (Y = real defect) but it is not',);
      },
    },),

    it({
      name: 'ignores lines that are not item headings, so surrounding prose '
        + 'never becomes an item',
      fn: async () => {
        const items = parseGradedSheet({
          text: `> PRELIMINARY draw, grade: nothing here\n${
            catSheet({ answers: ['[Y]',], },)
          }`,
        },);
        expect(items,).toHaveLength(1,);
      },
    },),
  ],
},);

await describe({
  name: scoreGradedPrecision.name,
  children: [
    it({
      name: 'excludes declined items from the denominator, since a question '
        + 'the grader refused is not evidence either way',
      fn: async () => {
        const tally = scoreGradedPrecision({
          human: parseGradedSheet({
            text: catSheet({
              answers: [
                '[Y]',
                '[Y]',
                '[N]',
                '[Not enough context to grade]',
              ],
            },),
          },),
        },);
        expect(tally.scored,).toBe(3,);
        expect(tally.realDefects,).toBe(2,);
        expect(tally.unscored,).toEqual([4,],);
      },
    },),
  ],
},);

await describe({
  name: scoreGradeAgreement.name,
  children: [
    it({
      name: 'names every disagreement and scores only over items the human '
        + 'graded',
      fn: async () => {
        /** Human grades: real, real, false, declined. */
        const human = parseGradedSheet({
          text: catSheet({
            answers: [
              '[Y]',
              '[Y]',
              '[N]',
              '[Not sure]',
            ],
          },),
        },);
        const tally = scoreGradeAgreement({
          agent: catPreGrades({
            verdicts: [
              'real-defect',
              'false-positive',
              'false-positive',
              'real-defect',
            ],
          },),
          human,
        },);
        expect(tally.compared,).toBe(3,);
        expect(tally.agreed,).toBe(2,);
        expect(tally.disagreed,).toEqual([2,],);
        // The declined item is reported, never silently folded into agreement.
        expect(tally.unscored,).toEqual([4,],);
      },
    },),

    it({
      name: 'refuses to compare two sets that cover different draws, which '
        + 'would otherwise report an agreement rate across rounds',
      fn: async () => {
        /** Failure raised by the mismatched coverage. */
        let caught: unknown;
        try {
          scoreGradeAgreement({
            agent: catPreGrades({ verdicts: ['real-defect',], },),
            human: parseGradedSheet({
              text: catSheet({
                answers: [
                  '[Y]',
                  '[N]',
                ],
              },),
            },),
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('not the same draw',);
      },
    },),
  ],
},);
