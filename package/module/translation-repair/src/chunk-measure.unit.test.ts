/**
 * Tests for the deterministic measurements candidate selection ranks a patched
 * chunk by.
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
  type AdjudicatedIssue,
  type EditableEnvelope,
  hashContent,
  type IssueResolutionTally,
  measurePatchedCandidate,
  selectCreditableIssues,
  parseDocument,
  type PatchOperation,
} from '../dist/final/node/index.mjs';

/**
 * Builds one checker tally with the vote counts a majority of that shape would
 * have produced; only the two verdict flags are read here.
 *
 * @param resolved - whether the checkers judged the defect gone
 *
 * @param regressed - whether they judged the revision damaged the region
 *
 * @returns Tally the measurement reads
 *
 * @example
 * ```ts
 * const tally = catTally({ resolved: true, regressed: false, },);
 * ```
 */
function catTally(
  {
    resolved,
    regressed,
  }: {
    readonly resolved: boolean;
    readonly regressed: boolean;
  },
): IssueResolutionTally {
  return {
    fixed: resolved ? 2 : 0,
    notFixed: resolved ? 0 : 2,
    worse: regressed ? 2 : 0,
    resolved,
    regressed,
  };
}

/**
 * Translation the patched candidate is measured against.
 */
const TARGET_TEXT = 'The cat is doing the sleeping.\n';

/**
 * Builds one accepted issue at the given severity.
 *
 * @param issueId - adjudicated identity
 *
 * @param severity - adjudicated severity
 *
 * @returns Issue the checkers reported on
 *
 * @example
 * ```ts
 * const issue = catIssue({ issueId: 'adjudicated/nap', severity: 'major', },);
 * ```
 */
function catIssue(
  {
    issueId,
    severity,
  }: {
    readonly issueId: string;
    readonly severity: 'minor' | 'major' | 'critical';
  },
): AdjudicatedIssue {
  return {
    issueId,
    status: 'accepted' as const,
    severity,
    claims: [],
    tallies: {},
  };
}

/**
 * Builds one envelope over the given base text.
 *
 * @param baseText - text occupying the envelope
 *
 * @returns Envelope the measurement reads lengths from
 *
 * @example
 * ```ts
 * const envelope = catEnvelope({ baseText: 'naps', },);
 * ```
 */
function catEnvelope({ baseText, }: { readonly baseText: string; },): EditableEnvelope {
  return {
    envelopeId: 'envelope/nap',
    startOffset: 0,
    endOffset: baseText.length,
    baseText,
    baseHash: hashContent({ content: baseText, },),
    issueIds: ['adjudicated/nap',],
  };
}

/**
 * Builds one applied operation against the fixture envelope.
 *
 * @param newText - replacement text
 *
 * @returns Operation the measurement reads lengths from
 *
 * @example
 * ```ts
 * const operation = catOperation({ newText: 'sleeps', },);
 * ```
 */
function catOperation({ newText, }: { readonly newText: string; },): PatchOperation {
  return {
    envelopeId: 'envelope/nap',
    baseHash: 'unread-by-the-measurement',
    newText,
  };
}

await describe({
  name: measurePatchedCandidate.name,
  children: [
    it({
      name: 'counts only major and critical resolutions as high severity, and '
        + 'carries the caller\'s resolved total through untouched',
      fn: async () => {
        const measurements = measurePatchedCandidate({
          acceptedIssues: [
            catIssue({
              issueId: 'adjudicated/nap',
              severity: 'major',
            },),
            catIssue({
              issueId: 'adjudicated/chase',
              severity: 'critical',
            },),
            catIssue({
              issueId: 'adjudicated/purr',
              severity: 'minor',
            },),
          ],
          tallies: {
            'adjudicated/nap': catTally({
              resolved: true,
              regressed: false,
            },),
            'adjudicated/chase': catTally({
              resolved: true,
              regressed: false,
            },),
            'adjudicated/purr': catTally({
              resolved: true,
              regressed: false,
            },),
          },
          resolvedTotal: 3,
          envelopes: [],
          applied: [],
          patchedDocument: parseDocument({ text: TARGET_TEXT, },),
          targetDocument: parseDocument({ text: TARGET_TEXT, },),
        },);
        expect(measurements.resolvedHighSeverity,).toBe(2,);
        expect(measurements.resolvedTotal,).toBe(3,);
      },
    },),

    it({
      name: 'ignores an unresolved high-severity issue and counts a regressed '
        + 'one',
      fn: async () => {
        const measurements = measurePatchedCandidate({
          acceptedIssues: [
            catIssue({
              issueId: 'adjudicated/nap',
              severity: 'major',
            },),
          ],
          tallies: {
            'adjudicated/nap': catTally({
              resolved: false,
              regressed: true,
            },),
          },
          resolvedTotal: 0,
          envelopes: [],
          applied: [],
          patchedDocument: parseDocument({ text: TARGET_TEXT, },),
          targetDocument: parseDocument({ text: TARGET_TEXT, },),
        },);
        expect(measurements.resolvedHighSeverity,).toBe(0,);
        expect(measurements.regressedKnownIssues,).toBe(1,);
      },
    },),

    it({
      name: 'treats an issue with no checker verdict as neither resolved nor '
        + 'regressed, since silence proves nothing either way',
      fn: async () => {
        const measurements = measurePatchedCandidate({
          acceptedIssues: [
            catIssue({
              issueId: 'adjudicated/nap',
              severity: 'critical',
            },),
          ],
          tallies: {},
          resolvedTotal: 0,
          envelopes: [],
          applied: [],
          patchedDocument: parseDocument({ text: TARGET_TEXT, },),
          targetDocument: parseDocument({ text: TARGET_TEXT, },),
        },);
        expect(measurements.resolvedHighSeverity,).toBe(0,);
        expect(measurements.regressedKnownIssues,).toBe(0,);
      },
    },),

    it({
      name: 'sizes a change by the larger of the region it replaced and the '
        + 'text it wrote, so neither a deletion nor an insertion reads as free',
      fn: async () => {
        /** Replacement shorter than the region it replaces. */
        const shrinking = measurePatchedCandidate({
          acceptedIssues: [],
          tallies: {},
          resolvedTotal: 0,
          envelopes: [catEnvelope({ baseText: 'is doing the sleeping', },),],
          applied: [catOperation({ newText: 'sleeps', },),],
          patchedDocument: parseDocument({ text: TARGET_TEXT, },),
          targetDocument: parseDocument({ text: TARGET_TEXT, },),
        },);
        expect(shrinking.touchedRegionChars,).toBe('is doing the sleeping'.length,);

        /** Insertion into a zero-width envelope. */
        const inserting = measurePatchedCandidate({
          acceptedIssues: [],
          tallies: {},
          resolvedTotal: 0,
          envelopes: [catEnvelope({ baseText: '', },),],
          applied: [catOperation({ newText: ' She purrs.', },),],
          patchedDocument: parseDocument({ text: TARGET_TEXT, },),
          targetDocument: parseDocument({ text: TARGET_TEXT, },),
        },);
        expect(inserting.touchedRegionChars,).toBe(' She purrs.'.length,);
      },
    },),

    it({
      name: 'passes integrity when the patch introduces no new downgrade and '
        + 'fails it when the patch forces a fallback to plain markdown',
      fn: async () => {
        /** Translation whose component markup parses strictly. */
        const wholeText = '<Aside>\n\nThe cat naps.\n\n</Aside>\n';

        /** Same translation with the component tag left unclosed. */
        const brokenText = '<Aside>\n\nThe cat naps.\n';

        const intact = measurePatchedCandidate({
          acceptedIssues: [],
          tallies: {},
          resolvedTotal: 0,
          envelopes: [],
          applied: [],
          patchedDocument: parseDocument({ text: wholeText, },),
          targetDocument: parseDocument({ text: wholeText, },),
        },);
        expect(intact.integrityOk,).toBe(true,);

        const broken = measurePatchedCandidate({
          acceptedIssues: [],
          tallies: {},
          resolvedTotal: 0,
          envelopes: [],
          applied: [],
          patchedDocument: parseDocument({ text: brokenText, },),
          targetDocument: parseDocument({ text: wholeText, },),
        },);
        expect(broken.integrityOk,).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: selectCreditableIssues.name,
  children: [
    it({
      name: 'credits an issue whose envelope an applied operation actually '
        + 'served, which is the only credit that says the patch improved '
        + 'anything',
      fn: async () => {
        expect(
          selectCreditableIssues({
            acceptedIssues: [
              catIssue({
                issueId: 'adjudicated/nap',
                severity: 'major',
              },),
            ],
            envelopes: [catEnvelope({ baseText: 'naps', },),],
            applied: [catOperation({ newText: 'sleeps', },),],
          },).map(function toId(issue,) {
            return issue.issueId;
          },),
        ).toStrictEqual(['adjudicated/nap',],);
      },
    },),

    it({
      name: 'REFUSES credit for an issue no applied operation served, which is '
        + 'the defect this exists to remove: checkers answer per issue against '
        + 'the whole patched text, so they will call an untouched issue fixed '
        + 'whenever the original wording already reads acceptably, and counting '
        + 'that let a patch touching issue A beat unchanged on credit for '
        + 'issue B that nothing touched',
      fn: async () => {
        expect(
          selectCreditableIssues({
            acceptedIssues: [
              catIssue({
                issueId: 'adjudicated/nap',
                severity: 'major',
              },),
              catIssue({
                issueId: 'adjudicated/untouched',
                severity: 'critical',
              },),
            ],
            envelopes: [catEnvelope({ baseText: 'naps', },),],
            applied: [catOperation({ newText: 'sleeps', },),],
          },).map(function toId(issue,) {
            return issue.issueId;
          },),
        ).toStrictEqual(['adjudicated/nap',],);
      },
    },),

    it({
      name: 'credits nothing when the patch applied nothing, so a candidate '
        + 'whose every operation was rejected cannot beat unchanged on credit '
        + 'it never earned',
      fn: async () => {
        expect(
          selectCreditableIssues({
            acceptedIssues: [
              catIssue({
                issueId: 'adjudicated/nap',
                severity: 'major',
              },),
            ],
            envelopes: [catEnvelope({ baseText: 'naps', },),],
            applied: [],
          },),
        ).toStrictEqual([],);
      },
    },),

    it({
      name: 'credits nothing when an applied operation names an envelope that '
        + 'is not on the list, rather than crediting every issue or throwing: '
        + 'an unmatched envelope means the caller passed mismatched sets, and '
        + 'guessing either way would move a milestone number',
      fn: async () => {
        expect(
          selectCreditableIssues({
            acceptedIssues: [
              catIssue({
                issueId: 'adjudicated/nap',
                severity: 'major',
              },),
            ],
            envelopes: [],
            applied: [catOperation({ newText: 'sleeps', },),],
          },),
        ).toStrictEqual([],);
      },
    },),

    it({
      name: 'returns credited issues in ISSUE order rather than in operation '
        + 'order, so a scorecard reads the same way whichever order the editor '
        + 'happened to write its operations',
      fn: async () => {
        /**
         * Envelope naming both issues, so both are served by one operation.
         */
        const envelope = {
          ...catEnvelope({ baseText: 'naps', },),
          issueIds: [
            'adjudicated/second',
            'adjudicated/nap',
          ],
        };

        expect(
          selectCreditableIssues({
            acceptedIssues: [
              catIssue({
                issueId: 'adjudicated/nap',
                severity: 'major',
              },),
              catIssue({
                issueId: 'adjudicated/second',
                severity: 'minor',
              },),
            ],
            envelopes: [envelope,],
            applied: [catOperation({ newText: 'sleeps', },),],
          },).map(function toId(issue,) {
            return issue.issueId;
          },),
        ).toStrictEqual([
          'adjudicated/nap',
          'adjudicated/second',
        ],);
      },
    },),
  ],
},);
