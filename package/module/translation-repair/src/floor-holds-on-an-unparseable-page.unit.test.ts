/**
 * Tests that the structural floor still floors when the page refuses the strict
 * grammar.
 *
 * WHAT THIS FILE EXISTS TO STOP, measured on the sixth consolidation bed rather
 * than imagined. A slice boundary fell between an opening `details` tag and its
 * closing tag, so the page span carried no closing tag and the strict MDX
 * grammar refused it. The floor then had no block list to compare against, fell
 * back to the original alone, and a 164-character rendering passed against a
 * 3875-character page. Both lanes had carried that page whole; only the third
 * rendering dropped it, and it shipped.
 *
 * A CHECK THAT CANNOT RUN MUST NOT ANSWER YES. The page side now downgrades to
 * plain markdown, which reads the same span as a paragraph followed by an html
 * block, and the floor refuses the one-paragraph candidate on its own evidence.
 *
 * WHY THE FIXTURE IS UNBALANCED ON PURPOSE. A WELL-FORMED `details` element
 * parses under the strict grammar perfectly well, so a tidy fixture proves
 * nothing here: it would pass before the fix and after it. Only a span cut
 * through an element reproduces the refusal.
 *
 * Fixtures are cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type SliceValidation,
  validateTranslatedSlice,
} from '../dist/final/node/index.mjs';

//region Fixtures

/**
 * Chinese standing in for the note, which is all this slice's original is.
 */
const SOURCE_TEXT = '（注：内容可能引起不适）';

/**
 * Page whose span was cut between the opening tag and its close, so the strict
 * grammar has a complaint no producer could answer.
 */
const CUT_PAGE = `(Warning: this account may be upsetting.)

<details>
<summary>The cat's requests</summary>
> Feed the birds at dawn.
> Leave the window open.`;

/**
 * Same page, closed properly, which the strict grammar reads without help.
 */
const WHOLE_PAGE = `${CUT_PAGE}
</details>`;

/**
 * Candidate carrying the note and nothing that followed it.
 */
const NOTE_ONLY = '(Note: this account may be upsetting; please be aware before reading.)';

/**
 * Pulls the findings out of a verdict that must be a refusal.
 *
 * NARROWS BY THROWING rather than by optional chaining, so a verdict that
 * unexpectedly passed fails the case where it happened instead of silently
 * comparing an empty string.
 *
 * @param verdict - what the floor answered
 *
 * @returns Findings joined, one per line
 *
 * @throws {@link Error} when the verdict was not a refusal
 *
 * @example
 * ```ts
 * const findings = findingsOf({ verdict, },);
 * ```
 */
function findingsOf({ verdict, }: { readonly verdict: SliceValidation; },): string {
  if (verdict.kind !== 'invalid')
    throw new Error(`expected a refusal, got ${verdict.kind}`,);

  return verdict.findings.join('\n',);
}

//endregion Fixtures

await describe({
  name: 'the floor holds on an unparseable page',
  children: [
    it({
      name: 'REFUSES a candidate that drops a page the strict grammar cannot read',
      fn: async () => {
        // Before the page side downgraded, this returned valid: the floor had
        // no blocks, and the candidate matched the one-block original.
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: NOTE_ONLY,
          pageText: CUT_PAGE,
        },);

        expect(verdict.kind,).toBe('invalid',);
        expect(findingsOf({ verdict, },),).toContain('PAGE AS IT STANDS',);
      },
    },),

    it({
      name: 'TELLS the producer what the relaxed reading found, not that parsing failed',
      fn: async () => {
        // The finding has to be actionable. A producer cannot fix the archive's
        // grammar, but it can carry the blocks the page has.
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: NOTE_ONLY,
          pageText: CUT_PAGE,
        },);

        expect(findingsOf({ verdict, },),).toContain('html',);
      },
    },),

    it({
      name: 'REFUSES the same drop when the page parses strictly, which is the positive control',
      fn: async () => {
        // Proves the assertion above is about the DOWNGRADE and not about the
        // floor in general: a well-formed page has always been floored on.
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: NOTE_ONLY,
          pageText: WHOLE_PAGE,
        },);

        expect(verdict.kind,).toBe('invalid',);
      },
    },),

    it({
      name: 'REFUSES even a faithful candidate here, at the candidate parse rather than the floor',
      fn: async () => {
        // NOT AN OVERSIGHT, and worth pinning. A candidate that reproduces the
        // cut page exactly is refused because the CANDIDATE side stays strict,
        // which is the older rule and the right one: text we cannot parse is
        // text we should not splice into a page.
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: CUT_PAGE,
          pageText: CUT_PAGE,
        },);

        expect(verdict.kind,).toBe('invalid',);
        expect(findingsOf({ verdict, },),).toContain('could not be parsed as Markdown',);
      },
    },),

    it({
      name: 'NAMES the grammar behind a pass, so a downgrade is never silent',
      fn: async () => {
        // A pass carries no findings to inspect, so without this the reader of
        // a valid verdict cannot tell a strict reading from a relaxed one.
        const relaxed = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: CUT_PAGE,
          pageText: CUT_PAGE,
        },);
        const strict = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: NOTE_ONLY,
          pageText: '',
        },);

        // The relaxed case is a refusal for other reasons; what matters is that
        // a pass on a strictly read page says so.
        expect(relaxed.kind,).toBe('invalid',);
        expect(strict.kind,).toBe('valid',);
        expect(strict.kind === 'valid' ? strict.pageGrammar : 'not-valid',).toBe('absent',);
      },
    },),

    it({
      name: 'REFUSES a well-formed candidate too, so nothing ships at a cut slice',
      fn: async () => {
        // The two grammars disagree about what the same element IS: the page,
        // read relaxed, calls it an html block, while a candidate read strictly
        // calls it an mdxJsxFlowElement. So a candidate cannot satisfy the floor
        // here even by writing the element correctly.
        //
        // FAIL-CLOSED BOTH WAYS IS THE SAFE ANSWER for a span that is not a
        // well-formed fragment: every candidate is refused, the incumbent
        // stays, and the content survives. It is NOT shipping, and making these
        // slices shippable belongs to the slicer rather than to this check.
        const verdict = validateTranslatedSlice({
          sourceText: SOURCE_TEXT,
          candidateText: WHOLE_PAGE,
          pageText: CUT_PAGE,
        },);

        expect(verdict.kind,).toBe('invalid',);
        expect(findingsOf({ verdict, },),).toContain('mdxJsxFlowElement',);
      },
    },),
  ],
},);
