/**
 Tests for envelope derivation and the deterministic patch gate.
 Fixtures are cat-themed invention mirroring corpus structure only.
 
 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  type AdjudicatedIssue,
  type AdjudicationStatus,
  applyPatchOperations,
  buildLicensedQuotes,
  buildRemovableQuotes,
  deriveEditableEnvelopes,
  EnvelopeOverlapError,
  hashContent,
  type SpanAnchor,
} from '../dist/final/node/index.mjs';

/**
 Invented translation every fixture cuts envelopes from.
 */
const TARGET_TEXT = 'The cat naps in the sun. It chases red butterflies. The bowl stays full.';

/**
 Target-side span at chosen offsets over the fixture text.
 */
function span(
  {
    startOffset,
    endOffset,
  }: {
    readonly startOffset: number;
    readonly endOffset: number;
  },
): SpanAnchor {
  return {
    side: 'target',
    nodeId: 'block/1',
    nodeHash: hashContent({ content: TARGET_TEXT, },),
    startOffset,
    endOffset,
    quotedText: TARGET_TEXT.slice(startOffset, endOffset,),
  };
}

/**
 Adjudicated single-claim issue with chosen status and spans.
 */
function issue(
  {
    suffix,
    status,
    spans,
  }: {
    readonly suffix: string;
    readonly status: AdjudicationStatus;
    readonly spans: readonly SpanAnchor[];
  },
): AdjudicatedIssue {
  return {
    issueId: `adjudicated/${suffix}`,
    status,
    severity: 'major',
    claims: [
      {
        claimId: `issue/${suffix}`,
        claim: {
          category: 'accuracy/mistranslation',
          severity: 'major',
          summary: `The ${suffix} sentence drifts from the source.`,
          spans,
        },
      },
    ],
    tallies: {},
  };
}

await describe({
  name: deriveEditableEnvelopes.name,
  children: [
    it({
      name: 'cuts envelopes only from accepted issues',
      fn: async () => {
        /** One accepted, one rejected, one needs-human issue. */
        const plan = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'napping',
              status: 'accepted',
              spans: [span({ startOffset: 4, endOffset: 12, },),],
            },),
            issue({
              suffix: 'chasing',
              status: 'rejected',
              spans: [span({ startOffset: 28, endOffset: 40, },),],
            },),
            issue({
              suffix: 'bowl',
              status: 'needs-human',
              spans: [span({ startOffset: 56, endOffset: 64, },),],
            },),
          ],
          targetText: TARGET_TEXT,
        },);
        expect(plan.envelopes,).toHaveLength(1,);
        expect(plan.envelopes[0]?.baseText,).toBe('cat naps',);
        expect(plan.envelopes[0]?.baseHash,).toBe(hashContent({ content: 'cat naps', },),);
        expect(plan.envelopes[0]?.issueIds,).toEqual(['adjudicated/napping',],);
        expect(plan.unenveloped,).toHaveLength(0,);
      },
    },),

    it({
      name: 'merges overlapping and touching spans into one envelope carrying both issues',
      fn: async () => {
        /** Two accepted issues with overlapping evidence. */
        const plan = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'left',
              status: 'accepted',
              spans: [span({ startOffset: 4, endOffset: 12, },),],
            },),
            issue({
              suffix: 'right',
              status: 'accepted',
              spans: [span({ startOffset: 12, endOffset: 23, },),],
            },),
          ],
          targetText: TARGET_TEXT,
        },);
        expect(plan.envelopes,).toHaveLength(1,);
        expect(plan.envelopes[0]?.baseText,).toBe('cat naps in the sun',);
        expect(plan.envelopes[0]?.issueIds,).toEqual([
          'adjudicated/left',
          'adjudicated/right',
        ],);
      },
    },),

    it({
      name: 'keeps zero-width insertion envelopes and reports anchorless issues',
      fn: async () => {
        /** One insertion-anchored issue and one source-only issue. */
        const plan = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'missing',
              status: 'accepted',
              spans: [span({ startOffset: 52, endOffset: 52, },),],
            },),
            issue({
              suffix: 'source-only',
              status: 'accepted',
              spans: [
                {
                  side: 'source',
                  nodeId: 'block/9',
                  nodeHash: hashContent({ content: '猫猫的句子。', },),
                  startOffset: 3,
                  endOffset: 9,
                  quotedText: '猫猫的句子。',
                },
              ],
            },),
          ],
          targetText: TARGET_TEXT,
        },);
        expect(plan.envelopes,).toHaveLength(1,);
        expect(plan.envelopes[0]?.startOffset,).toBe(52,);
        expect(plan.envelopes[0]?.endOffset,).toBe(52,);
        expect(plan.envelopes[0]?.baseText,).toBe('',);
        expect(plan.unenveloped,).toEqual(['adjudicated/source-only',],);
      },
    },),
  ],
},);

await describe({
  name: applyPatchOperations.name,
  children: [
    it({
      name: 'replaces, inserts, and shifts offsets correctly across envelopes',
      fn: async () => {
        /** Replacement envelope over the napping clause plus an insertion point. */
        const { envelopes, } = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'napping',
              status: 'accepted',
              spans: [span({ startOffset: 4, endOffset: 12, },),],
            },),
            issue({
              suffix: 'missing',
              status: 'accepted',
              spans: [span({ startOffset: 52, endOffset: 52, },),],
            },),
          ],
          targetText: TARGET_TEXT,
        },);
        /** Envelopes in document order: replacement first, insertion second. */
        const [replaceEnvelope, insertEnvelope,] = envelopes;
        if ((replaceEnvelope === undefined) || (insertEnvelope === undefined))
          throw new Error('fixture derivation failed',);
        /** Application of one replacement and one insertion. */
        const outcome = applyPatchOperations({
          targetText: TARGET_TEXT,
          envelopes,
          operations: [
            {
              envelopeId: replaceEnvelope.envelopeId,
              baseHash: replaceEnvelope.baseHash,
              newText: 'kitten dozes',
            },
            {
              envelopeId: insertEnvelope.envelopeId,
              baseHash: insertEnvelope.baseHash,
              newText: 'It purrs at dusk. ',
            },
          ],
          preservation: { mode: 'skip', },
        },);
        expect(outcome.applied,).toHaveLength(2,);
        expect(outcome.rejected,).toHaveLength(0,);
        expect(outcome.patchedText,).toBe(
          'The kitten dozes in the sun. It chases red butterflies. It purrs at dusk. The bowl stays full.',
        );
      },
    },),

    it({
      name: 'rejects unknown envelopes, duplicates, stale hashes, and unchanged regions',
      fn: async () => {
        /** One valid envelope. */
        const { envelopes, } = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'napping',
              status: 'accepted',
              spans: [span({ startOffset: 4, endOffset: 12, },),],
            },),
          ],
          targetText: TARGET_TEXT,
        },);
        /** Sole envelope. */
        const [envelope,] = envelopes;
        if (envelope === undefined)
          throw new Error('fixture derivation failed',);
        /** Application exercising every rejection gate. */
        const outcome = applyPatchOperations({
          targetText: TARGET_TEXT,
          envelopes,
          operations: [
            {
              envelopeId: 'envelope/invented',
              baseHash: envelope.baseHash,
              newText: 'kitten dozes',
            },
            {
              envelopeId: envelope.envelopeId,
              baseHash: hashContent({ content: 'some other base', },),
              newText: 'kitten dozes',
            },
            {
              envelopeId: envelope.envelopeId,
              baseHash: envelope.baseHash,
              newText: envelope.baseText,
            },
            {
              envelopeId: envelope.envelopeId,
              baseHash: envelope.baseHash,
              newText: 'kitten dozes',
            },
            {
              envelopeId: envelope.envelopeId,
              baseHash: envelope.baseHash,
              newText: 'tabby rests',
            },
          ],
          preservation: { mode: 'skip', },
        },);
        expect(outcome.rejected.map(function toReason(rejection,) {
          return rejection.reason;
        },),).toEqual([
          'unknown-envelope',
          'stale-base-hash',
          'unchanged-region',
          'duplicate-operation',
        ],);
        expect(outcome.applied,).toHaveLength(1,);
        expect(outcome.patchedText,).toBe(
          'The kitten dozes in the sun. It chases red butterflies. The bowl stays full.',
        );
      },
    },),

    it({
      name: 'rejects operations whose envelope no longer matches the document',
      fn: async () => {
        /** Envelope derived from the fixture text. */
        const { envelopes, } = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'napping',
              status: 'accepted',
              spans: [span({ startOffset: 4, endOffset: 12, },),],
            },),
          ],
          targetText: TARGET_TEXT,
        },);
        /** Sole envelope. */
        const [envelope,] = envelopes;
        if (envelope === undefined)
          throw new Error('fixture derivation failed',);
        /** Application against a drifted document. */
        const outcome = applyPatchOperations({
          targetText: `PREFIX ${TARGET_TEXT}`,
          envelopes,
          operations: [
            {
              envelopeId: envelope.envelopeId,
              baseHash: envelope.baseHash,
              newText: 'kitten dozes',
            },
          ],
          preservation: { mode: 'skip', },
        },);
        expect(outcome.rejected[0]?.reason,).toBe('envelope-drift',);
        expect(outcome.patchedText,).toBe(`PREFIX ${TARGET_TEXT}`,);
      },
    },),

    it({
      name: 'throws on overlapping envelopes as a construction bug',
      fn: async () => {
        /** Two hand-built colliding envelopes. */
        const overlapping = [
          {
            envelopeId: 'envelope/one',
            startOffset: 4,
            endOffset: 12,
            baseText: TARGET_TEXT.slice(4, 12,),
            baseHash: hashContent({ content: TARGET_TEXT.slice(4, 12,), },),
            issueIds: ['adjudicated/one',],
          },
          {
            envelopeId: 'envelope/two',
            startOffset: 8,
            endOffset: 20,
            baseText: TARGET_TEXT.slice(8, 20,),
            baseHash: hashContent({ content: TARGET_TEXT.slice(8, 20,), },),
            issueIds: ['adjudicated/two',],
          },
        ];
        expect(function applyOverlapping() {
          applyPatchOperations({
            targetText: TARGET_TEXT,
            envelopes: overlapping,
            operations: [],
            preservation: { mode: 'skip', },
          },);
        },).toThrow(EnvelopeOverlapError,);
      },
    },),

    it({
      name: 'REJECTS an operation that deletes a name no issue quoted, which is '
        + 'the whole point of wiring the preservation check here: the check '
        + 'existed and gated nothing, and a gate with no test at the call site '
        + 'is the failure this codebase keeps repeating',
      fn: async () => {
        /**
         Envelope whose text carries a contributor name.
         */
        const envelope = {
          envelopeId: 'envelope/credit',
          startOffset: 0,
          endOffset: 46,
          baseText: 'Contributor for this entry: Whiskers - Archive',
          baseHash: hashContent({ content: 'Contributor for this entry: Whiskers - Archive', },),
          issueIds: ['issue/colon',],
        };

        /**
         Edit that fixes nothing quoted and drops the name.
         */
        const outcome = applyPatchOperations({
          targetText: 'Contributor for this entry: Whiskers - Archive',
          envelopes: [envelope,],
          operations: [{
            envelopeId: 'envelope/credit',
            baseHash: envelope.baseHash,
            newText: 'Contributor for this entry: Archive',
          },],
          preservation: {
            mode: 'enforce',
            licensedQuotes: new Map([['envelope/credit', ['Contributor for this entry:',],],],),
            removableQuotes: new Map(),
          },
        },);

        expect(outcome.rejected,).toHaveLength(1,);
        expect(outcome.rejected[0]?.reason,).toContain('preservation-lost-distinctive',);
        expect(outcome.patchedText,).toBe('Contributor for this entry: Whiskers - Archive',);
      },
    },),
  ],
},);

/**
 One edit over an envelope that is wholly a licensed quote, which is how
 production cuts them: envelopes and licensed quotes are the same quotes
 (ledger L4), so the bulk and distinctive rules measure nothing there.

 @param baseText - archive text of the envelope, all of it quoted

 @param newText - what the editor writes over it

 @param removableQuotes - quotes an addition claim made, none by default

 @returns Outcome of the enforced application

 @example
 ```ts
 const outcome = editInsideQuote({ baseText: 'The cat napped[^1].', newText: 'The cat slept.', },);
 ```
 */
function editInsideQuote(
  {
    baseText,
    newText,
    removableQuotes = [],
  }: {
    readonly baseText: string;
    readonly newText: string;
    readonly removableQuotes?: readonly string[];
  },
) {
  /**
   The one envelope, over the whole text.
   */
  const envelope = {
    envelopeId: 'envelope/quoted',
    startOffset: 0,
    endOffset: baseText.length,
    baseText,
    baseHash: hashContent({ content: baseText, },),
    issueIds: ['adjudicated/quoted',],
  };
  return applyPatchOperations({
    targetText: baseText,
    envelopes: [envelope,],
    operations: [{
      envelopeId: envelope.envelopeId,
      baseHash: envelope.baseHash,
      newText,
    },],
    preservation: {
      mode: 'enforce',
      licensedQuotes: new Map([[envelope.envelopeId, [baseText,],],],),
      removableQuotes: new Map([[envelope.envelopeId, removableQuotes,],],),
    },
  },);
}

/**
 One markup atom an edit inside a licensed quote drops or changes, which the
 gate must refuse whatever the issue says, except an addition's removal.
 */
type LostAtomCase = {
  /**
   Which kind of atom the case loses.
   */
  readonly kind: string;

  /**
   Archive text carrying the atom.
   */
  readonly baseText: string;

  /**
   Edit that loses or changes it.
   */
  readonly newText: string;
};

/**
 One case per kind the owner named: footnote references, link destinations,
 MDX expressions, inline code and tags.
 */
const LOST_ATOM_CASES: readonly LostAtomCase[] = [
  {
    kind: 'footnote reference',
    baseText: 'The cat napped[^1] all afternoon.',
    newText: 'The cat slept all afternoon.',
  },
  {
    kind: 'link destination',
    baseText: 'She met [the tabby](https://example.org/cat_(tabby)) at noon.',
    newText: 'She met [the tabby](https://example.org/cat) at noon.',
  },
  {
    kind: 'MDX expression',
    baseText: 'The cat {/* keeper note: fed twice */} slept by the door.',
    newText: 'The cat slept by the door.',
  },
  {
    kind: 'inline code',
    baseText: 'Type `meow` to call the cat.',
    newText: 'Type meow to call the cat.',
  },
  {
    kind: 'tag',
    baseText: 'The cat <Paw side="left" /> slept by the door.',
    newText: 'The cat slept by the door.',
  },
];

await describe({
  name: 'markup atoms inside a licensed quote (ledger L4)',
  children: [
    ...LOST_ATOM_CASES.map(function toCase({ kind, baseText, newText, },) {
      return it({
        name: `REJECTS an edit that loses a ${kind} inside the quote its issue licensed, where the bulk and `
          + 'distinctive rules measure nothing (residual tokens were 0 on 536 of 540 regions): the owner ruled '
          + '2026-09-28 that markup atoms survive every edit except a removal an addition issue names',
        fn: async () => {
          const outcome = editInsideQuote({ baseText, newText, },);
          expect(outcome.applied,).toHaveLength(0,);
          expect(outcome.rejected[0]?.reason,).toContain('preservation-lost-markup',);
          expect(outcome.patchedText,).toBe(baseText,);
        },
      },);
    },),

    it({
      name: 'APPLIES an edit inside the quote that rewords the prose and keeps every atom, the control that '
        + 'shows the refusals are about the atoms',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'The cat napped[^1] by `meow` and [the door](https://example.org/door).',
          newText: 'The cat slept[^1] by `meow` and [the door](https://example.org/door).',
        },);
        expect(outcome.applied,).toHaveLength(1,);
      },
    },),

    it({
      name: 'APPLIES an edit that gains an atom, since the measured gains are omission fixes restoring a '
        + 'footnote reference, a link destination or a tag',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'The cat slept by the door.',
          newText: 'The cat slept by the door[^2].',
        },);
        expect(outcome.applied,).toHaveLength(1,);
      },
    },),

    it({
      name: 'APPLIES the removal of a footnote reference inside text an addition claim quoted, since removing '
        + 'the detail an addition quotes is the fix and the reference goes with it',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'The cat napped by the door, a gift from the neighbours[^3].',
          newText: 'The cat napped by the door.',
          removableQuotes: [', a gift from the neighbours[^3]',],
        },);
        expect(outcome.applied,).toHaveLength(1,);
      },
    },),

    it({
      name: 'REJECTS the loss of an atom outside the addition quote though an addition claim shares the '
        + 'envelope: the licence is the quote, not the envelope',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'The cat napped[^1] by the door, a gift from the neighbours[^3].',
          newText: 'The cat napped by the door.',
          removableQuotes: [', a gift from the neighbours[^3]',],
        },);
        expect(outcome.rejected[0]?.reason,).toBe('preservation-lost-markup (footnote-reference)',);
      },
    },),

    it({
      name: 'REJECTS losing one of two copies of the same atom, since a multiset that counted each value '
        + 'once would pass it',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'The cat[^1] and the kitten[^1] slept.',
          newText: 'The cat[^1] and the kitten slept.',
        },);
        expect(outcome.rejected[0]?.reason,).toBe('preservation-lost-markup (footnote-reference)',);
      },
    },),

    it({
      name: 'APPLIES an edit that moves an atom to another clause, since the ruling protects that it '
        + 'survives, not where',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'The cat[^1] napped by the door.',
          newText: 'The cat napped by the door[^1].',
        },);
        expect(outcome.applied,).toHaveLength(1,);
      },
    },),

    it({
      name: 'names each lost kind once and never the atom\'s text, which is page content stored with the '
        + 'refusal',
      fn: async () => {
        const outcome = editInsideQuote({
          baseText: 'See [the tabby](https://example.org/a) and [the kitten](https://example.org/b) today.',
          newText: 'See the tabby and the kitten today.',
        },);
        expect(outcome.rejected[0]?.reason,).toBe('preservation-lost-markup (link-destination)',);
      },
    },),
  ],
},);

await describe({
  name: buildRemovableQuotes.name,
  children: [
    it({
      name: 'licenses the quotes of addition CLAIMS only, so a mistranslation claim grouped into the same '
        + 'issue licenses no removal',
      fn: async () => {
        /** An issue grouping an addition claim with a mistranslation claim. */
        const grouped: AdjudicatedIssue = {
          issueId: 'adjudicated/grouped',
          status: 'accepted',
          severity: 'major',
          claims: [
            {
              claimId: 'issue/added',
              claim: {
                category: 'accuracy/addition',
                severity: 'major',
                summary: 'The fed sentence is not in the source.',
                spans: [span({ startOffset: 0, endOffset: 24, },),],
              },
            },
            {
              claimId: 'issue/drifted',
              claim: {
                category: 'accuracy/mistranslation',
                severity: 'major',
                summary: 'The butterflies drift from the source.',
                spans: [span({ startOffset: 20, endOffset: 51, },),],
              },
            },
          ],
          tallies: {},
        };
        /** One envelope over both spans. */
        const { envelopes, } = deriveEditableEnvelopes({
          issues: [grouped,],
          targetText: TARGET_TEXT,
        },);
        /** The quotes each builder licenses, by envelope. */
        const removable = buildRemovableQuotes({ envelopes, issues: [grouped,], },);
        const licensed = buildLicensedQuotes({ envelopes, issues: [grouped,], },);
        expect([...removable.values(),].flat(),).toStrictEqual([TARGET_TEXT.slice(0, 24,),],);
        expect([...licensed.values(),].flat().toSorted(),).toStrictEqual(
          [
            TARGET_TEXT.slice(0, 24,),
            TARGET_TEXT.slice(20, 51,),
          ].toSorted(),
        );
      },
    },),
  ],
},);

/**
 Curly-quoted document, the convention the restoration reads.
 */
const CURLY_TEXT = 'The cat’s bowl stays full. It chases red butterflies.';

await describe({
  name: 'typography before the gates',
  children: [
    it({
      name: 'REJECTS as unchanged an edit whose only difference is a flattened apostrophe, since the restored '
        + 'text is what ships and it equals the region; before, the edit was recorded as applied',
      fn: async () => {
        /** Envelope over the first sentence. */
        const { envelopes, } = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'bowl',
              status: 'accepted',
              spans: [span({ startOffset: 0, endOffset: 26, },),],
            },),
          ],
          targetText: CURLY_TEXT,
        },);
        /** The one envelope. */
        const [envelope,] = envelopes;
        if (envelope === undefined)
          throw new Error('fixture derivation failed',);

        const outcome = applyPatchOperations({
          targetText: CURLY_TEXT,
          envelopes,
          operations: [
            {
              envelopeId: envelope.envelopeId,
              baseHash: envelope.baseHash,
              newText: "The cat's bowl stays full.",
            },
          ],
          preservation: { mode: 'skip', },
        },);

        expect(outcome.applied,).toHaveLength(0,);
        expect(outcome.rejected.map(function toReason(rejection,): string {
          return rejection.reason;
        },),).toEqual(['unchanged-region',],);
        expect(outcome.patchedText,).toBe(CURLY_TEXT,);
      },
    },),

    it({
      name: 'records and ships the restored text for a real edit written with straight quotes',
      fn: async () => {
        /** Envelope over the first sentence. */
        const { envelopes, } = deriveEditableEnvelopes({
          issues: [
            issue({
              suffix: 'bowl',
              status: 'accepted',
              spans: [span({ startOffset: 0, endOffset: 26, },),],
            },),
          ],
          targetText: CURLY_TEXT,
        },);
        /** The one envelope. */
        const [envelope,] = envelopes;
        if (envelope === undefined)
          throw new Error('fixture derivation failed',);

        const outcome = applyPatchOperations({
          targetText: CURLY_TEXT,
          envelopes,
          operations: [
            {
              envelopeId: envelope.envelopeId,
              baseHash: envelope.baseHash,
              newText: "The cat's dish stays full.",
            },
          ],
          preservation: { mode: 'skip', },
        },);

        expect(outcome.applied.map(function toText(operation,): string {
          return operation.newText;
        },),).toEqual(['The cat’s dish stays full.',],);
        expect(outcome.patchedText,).toBe('The cat’s dish stays full. It chases red butterflies.',);
      },
    },),
  ],
},);
