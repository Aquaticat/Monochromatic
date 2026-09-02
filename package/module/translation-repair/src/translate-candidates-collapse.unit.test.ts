/**
 * Tests for which two renderings count as the same wording on a slate.
 *
 * WHY THIS FILE EXISTS. `collapseKey` trims the END of a rendering and the
 * trailing spaces of blank lines and blank quote lines, and nothing else, so
 * two translators whose text differs only there share one candidate and one
 * stake. Trimming the FRONT as well would look like the same tidying and is
 * not: leading spaces open a code block, indent a list item, and continue a
 * quotation, so two renderings differing there are two different pages.
 * Measured on 2026-08-25, trimming both ends failed no test. Trailing spaces on
 * a line carrying content are a Markdown hard break, which 65 of the pinned
 * corpus's pages use, so those stay.
 *
 * READ THROUGH `buildTranslateCandidates` rather than at the key itself,
 * because the collapse is only visible as what reaches the ballot: how many
 * candidates a judge is offered, and how many stakes each carries.
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
  buildTranslateCandidates,
  type HeardVoice,
  type RosterModelId,
  type TranslateReportWire,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Two seated translators, in roster order.
 */
const TRANSLATORS = [
  'hf:zai-org/GLM-5.3-Flash',
  'hf:Qwen/Qwen3.8-27B',
] as const satisfies readonly RosterModelId[];

/**
 * Builds one heard reply.
 *
 * @param at - roster position that answered
 *
 * @param translation - wording it proposed
 *
 * @returns Voice shaped as the gather returns one
 *
 * @example
 * ```ts
 * const voice = voiceOf({ at: 0, translation: 'The cat naps.', },);
 * ```
 */
function voiceOf(
  {
    at,
    translation,
  }: {
    readonly at: number;
    readonly translation: string;
  },
): HeardVoice<TranslateReportWire> {
  return {
    modelId: TRANSLATORS[at] ?? TRANSLATORS[0],
    value: { translation, },
  };
}

//endregion Fixtures

await describe({
  name: buildTranslateCandidates.name,
  children: [
    it({
      name: 'COLLAPSES two renderings that differ only after their last character, since a trailing '
        + 'newline is not a different translation and offering it twice would split one wording`s stake '
        + 'across two candidates',
      fn: async () => {
        const set = buildTranslateCandidates({
          voices: [
            voiceOf({
              at: 0,
              translation: 'The cat sleeps on the windowsill.',
            },),
            voiceOf({
              at: 1,
              translation: 'The cat sleeps on the windowsill.\n\n',
            },),
          ],
          translatorModelIds: [...TRANSLATORS,],
          incumbentText: '',
        },);
        expect(set.candidates,).toHaveLength(1,);
        expect(set.collapsed,).toBe(1,);
      },
    },),
    it({
      name: 'KEEPS two renderings that differ only BEFORE their first character apart, because leading '
        + 'spaces open a code block, indent a list item and continue a quotation. A key trimming both '
        + 'ends would merge two different pages and hand a judge one of them',
      fn: async () => {
        const set = buildTranslateCandidates({
          voices: [
            voiceOf({
              at: 0,
              translation: 'The cat sleeps on the windowsill.',
            },),
            voiceOf({
              at: 1,
              translation: '    The cat sleeps on the windowsill.',
            },),
          ],
          translatorModelIds: [...TRANSLATORS,],
          incumbentText: '',
        },);
        expect(set.candidates,).toHaveLength(2,);
        expect(set.collapsed,).toBe(0,);
        // The indented one is still on the ballot with its own bytes, which is
        // what a judge needs to see to reject it.
        expect(set.candidates
          .map(function toRendering(candidate,): string {
            return candidate.rendered;
          },),).toContain('    The cat sleeps on the windowsill.',);
      },
    },),

    it({
      name: 'COLLAPSES a rendering onto the incumbent when it differs only by a trailing space on a '
        + 'blank quote line (the Toka_ls slice 1 replacement of 2026-09-02, two bytes judged five to two), '
        + 'and KEEPS one apart that differs by a hard break on a content line',
      fn: async () => {
        /**
         * Archive text with a clean blank quote line.
         */
        const incumbent = '> The cat sleeps.\n>\n> The cat wakes.';
        const set = buildTranslateCandidates({
          voices: [
            voiceOf({
              at: 0,
              translation: '> The cat sleeps.\n> \n> The cat wakes.',
            },),
            voiceOf({
              at: 1,
              translation: '> The cat sleeps.  \n>\n> The cat wakes.',
            },),
          ],
          translatorModelIds: [...TRANSLATORS,],
          incumbentText: incumbent,
        },);
        /**
         * Renderings on the ballot.
         */
        const rendered = set.candidates
          .map(function toRendering(candidate,): string {
            return candidate.rendered;
          },);
        // The blank-quote variant is the incumbent's own bytes; the hard-break
        // variant is a different page and stays on the ballot as itself.
        expect(rendered,).toContain(incumbent,);
        expect(rendered,).toContain('> The cat sleeps.  \n>\n> The cat wakes.',);
        expect(set.candidates,).toHaveLength(2,);
        expect(set.findings,).toContain(`translate-matched-incumbent (${TRANSLATORS[0] ?? ''})`,);
      },
    },),

    it({
      name: 'FOLDS an invisible variant out of a translation at intake, names it with its author, '
        + 'and collapses the folded rendering into a plain one that says the same (#264)',
      fn: async () => {
        const set = buildTranslateCandidates({
          voices: [
            voiceOf({
              at: 0,
              translation: 'A part\u2011time shop cat.',
            },),
            voiceOf({
              at: 1,
              translation: 'A part-time shop cat.',
            },),
          ],
          translatorModelIds: TRANSLATORS,
          incumbentText: '',
        },);

        expect(set.candidates,).toHaveLength(1,);
        expect(set.candidates[0]?.rendered,).toBe('A part-time shop cat.',);
        expect(set.findings,).toStrictEqual([
          `invisible-variant-folded (U+2011 x1) (${TRANSLATORS[0] ?? ''})`,
        ],);
      },
    },),
  ],
},);
