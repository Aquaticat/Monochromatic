/**
 * Tests for what survives screening of one auditor's answer.
 *
 * THE OBLIGATION RUNS BOTH WAYS, and half of these cases exist for the
 * direction the first version left unenforced: a category resting on one side
 * must not carry a quote on the other. An `omission` arriving with candidate
 * text contradicts itself, and silently erasing that text let a voice file a
 * paired claim under a one-sided category and escape the evidence the paired
 * one asks for.
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
  type RenderingAuditFindingWire,
  screenRenderingAudit,
} from '../dist/final/node/index.mjs';

/**
 * Original every case screens against.
 */
const SOURCE_TEXT = '三只猫住在书店的阁楼里。她们不吃罐头，只喝温牛奶。';

/**
 * Rendering with the negation dropped.
 */
const CANDIDATE_TEXT = 'Three cats live in the bookshop attic. They eat canned food, and drink warm milk.';

/**
 * Characters of a model-supplied word a drop reason may repeat, as the screen
 * bounds it.
 */
const DROPPED_WORD_LIMIT = 32;

/**
 * Length of a single token that overruns that bound.
 */
const OVERLONG_LENGTH = 40;

/**
 * Fields a case may replace on the sound finding.
 *
 * SPELLED OUT rather than derived from the wire type, because every property
 * here is genuinely optional to a case: one that changes only the category
 * should not restate four quotes it does not care about.
 *
 * @example
 * ```ts
 * const overrides: FindingOverrides = { category: 'omission', };
 * ```
 */
type FindingOverrides = {
  /**
   * Category this case names.
   */
  readonly category?: string;

  /**
   * Original span identifying the occurrence.
   */
  readonly sourceLocator?: string;

  /**
   * Original span carrying the change.
   */
  readonly sourceFocus?: string;

  /**
   * Candidate span identifying the occurrence.
   */
  readonly candidateLocator?: string;

  /**
   * Candidate span carrying the change.
   */
  readonly candidateFocus?: string;

  /**
   * What the voice says the spans amount to.
   */
  readonly reason?: string;
};

/**
 * One finding with every field, which each case overrides one part of.
 *
 * @param overrides - fields this case changes
 *
 * @returns Finding as a voice would send it
 *
 * @example
 * ```ts
 * const finding = claim({ overrides: { category: 'omission', }, },);
 * ```
 */
function claim(
  { overrides, }: { readonly overrides: FindingOverrides; },
): RenderingAuditFindingWire {
  return {
    category: 'altered-polarity',
    sourceLocator: '她们不吃罐头',
    sourceFocus: '不吃',
    candidateLocator: 'They eat canned food',
    candidateFocus: 'eat',
    reason: 'the original denies it and the candidate asserts it',
    ...overrides,
  };
}

/**
 * Screens one answer carrying one finding.
 *
 * @param overrides - fields that finding changes
 *
 * @param verdict - what the voice cast
 *
 * @returns Screened report
 *
 * @example
 * ```ts
 * const screened = screenOne({ overrides: {}, },);
 * ```
 */
function screenOne(
  {
    overrides,
    verdict = 'defects-found',
  }: {
    readonly overrides: FindingOverrides;
    readonly verdict?: string;
  },
): ReturnType<typeof screenRenderingAudit> {
  return screenRenderingAudit({
    report: {
      verdict,
      findings: [claim({ overrides, },),],
    },
    sourceText: SOURCE_TEXT,
    candidateText: CANDIDATE_TEXT,
  },);
}

await describe({
  name: screenRenderingAudit.name,
  children: [
    it({
      name: 'KEEPS a paired finding that anchors on both sides, and reads each side as anchored',
      fn: async () => {
        const screened = screenOne({ overrides: {}, },);
        expect(screened.findings,).toHaveLength(1,);
        expect(screened.dropped,).toEqual([],);
        expect(screened.findings[0]
          ?.source
          .kind,).toBe('anchored',);
        expect(screened.findings[0]
          ?.candidate
          .kind,).toBe('anchored',);
      },
    },),
    it({
      name:
        'KEEPS an omission quoting the ORIGINAL only, since content the candidate never rendered has '
        + 'nothing in the candidate to point at, and marks the other side unused rather than empty',
      fn: async () => {
        const screened = screenOne({
          overrides: {
            category: 'omission',
            sourceLocator: '只喝温牛奶',
            sourceFocus: '温',
            candidateLocator: '',
            candidateFocus: '',
          },
        },);
        expect(screened.findings,).toHaveLength(1,);
        expect(screened.findings[0]
          ?.candidate
          .kind,).toBe('unused',);
      },
    },),
    it({
      name:
        'DROPS an omission carrying candidate text, a claim contradicting itself: it says the candidate '
        + 'rendered nothing here and then quotes what the candidate rendered here',
      fn: async () => {
        const screened = screenOne({
          overrides: {
            category: 'omission',
            sourceLocator: '只喝温牛奶',
            sourceFocus: '温',
            candidateLocator: 'drink warm milk',
            candidateFocus: 'warm',
          },
        },);
        expect(screened.findings,).toEqual([],);
        expect(screened.dropped,).toEqual(['forbidden-side-quote (candidate)',],);
      },
    },),
    it({
      name:
        'DROPS an unsupported-addition carrying original text, the mirror case, so a voice cannot file a '
        + 'paired claim under a one-sided category and skip the evidence a paired category asks for',
      fn: async () => {
        const screened = screenOne({
          overrides: {
            category: 'unsupported-addition',
            sourceLocator: '她们不吃罐头',
            sourceFocus: '不吃',
            candidateLocator: 'They eat canned food',
            candidateFocus: 'canned',
          },
        },);
        expect(screened.findings,).toEqual([],);
        expect(screened.dropped,).toEqual(['forbidden-side-quote (source)',],);
      },
    },),
    it({
      name: 'DROPS a paired finding that anchors on one side only, naming which side failed',
      fn: async () => {
        const screened = screenOne({
          overrides: {
            candidateLocator: 'They devour canned food',
            candidateFocus: 'devour',
          },
        },);
        expect(screened.findings,).toEqual([],);
        expect(screened.dropped,).toEqual(['unanchored-locator (candidate)',],);
      },
    },),
    it({
      name:
        'DROPS a claim whose original quote is another translation`s English rather than the original`s '
        + 'Chinese, which is what keeps a rendering nobody was shown out of this instrument',
      fn: async () => {
        const screened = screenOne({
          overrides: {
            sourceLocator: 'They do not eat canned food',
            sourceFocus: 'not',
          },
        },);
        expect(screened.findings,).toEqual([],);
        expect(screened.dropped,).toEqual(['unanchored-locator (source)',],);
      },
    },),
    it({
      name: 'DROPS a category this version does not name, and says which word it was',
      fn: async () => {
        const screened = screenOne({ overrides: { category: 'altered-whiskers', }, },);
        expect(screened.findings,).toEqual([],);
        expect(screened.dropped,).toEqual(['unknown-category (altered-whiskers)',],);
      },
    },),
    it({
      name: 'BOUNDS THE WORD IT REPEATS from an unknown category to its first token, since the drop '
        + 'list is persisted in every run row and exists to say which word, not to store prose',
      fn: async () => {
        const screened = screenOne({
          overrides: { category: 'altered whiskers, and then a whole sentence about the cat on the sill', },
        },);
        expect(screened.dropped,).toEqual(['unknown-category (altered)',],);
      },
    },),
    it({
      name: 'BOUNDS A LONG SINGLE TOKEN to the first characters of the limit, so no field can carry '
        + 'prose through by leaving the spaces out',
      fn: async () => {
        const screened = screenOne({ overrides: { category: 'x'.repeat(OVERLONG_LENGTH,), }, },);
        expect(screened.dropped,).toEqual([`unknown-category (${'x'.repeat(DROPPED_WORD_LIMIT,)})`,],);
      },
    },),
    it({
      name: 'BOUNDS AN UNKNOWN VERDICT the same way, since the verdict field is the other one a '
        + 'model writes free text into',
      fn: async () => {
        const screened = screenOne({
          overrides: {},
          verdict: 'catastrophic failure of the whole rendering',
        },);
        expect(screened.verdict,).toBe('uncertain',);
        expect(screened.dropped,).toEqual(['unknown-verdict (catastrophic)',],);
      },
    },),
    it({
      name:
        'RECORDS an unknown verdict rather than quietly reading it as uncertain: a voice casting a word '
        + 'this version never offered is a protocol failure, while uncertain is a state a voice may '
        + 'legitimately be in, and reading one as the other hides an instrument defect',
      fn: async () => {
        const screened = screenOne({
          overrides: {},
          verdict: 'catastrophic',
        },);
        expect(screened.verdict,).toBe('uncertain',);
        expect(screened.dropped,).toEqual(['unknown-verdict (catastrophic)',],);
        // AND THE FINDING SURVIVES, because a mis-cast verdict is not a reason
        // to discard evidence that anchors.
        expect(screened.findings,).toHaveLength(1,);
      },
    },),
    it({
      name: 'KEEPS a known verdict without adding anything to the drop list',
      fn: async () => {
        const screened = screenRenderingAudit({
          report: {
            verdict: 'no-defect-found',
            findings: [],
          },
          sourceText: SOURCE_TEXT,
          candidateText: CANDIDATE_TEXT,
        },);
        expect(screened.verdict,).toBe('no-defect-found',);
        expect(screened.dropped,).toEqual([],);
      },
    },),
  ],
},);
