/**
 * Tests for envelope derivation and the deterministic patch gate.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type {
  AdjudicatedIssue,
  AdjudicationStatus,
} from './adjudicate-model.ts';
import {
  applyPatchOperations,
  EnvelopeOverlapError,
} from './apply-patch.ts';
import { hashContent, } from './document-node.ts';
import type { SpanAnchor, } from './issue-model.ts';
import { deriveEditableEnvelopes, } from './patch-model.ts';

/**
 * Invented translation every fixture cuts envelopes from.
 */
const TARGET_TEXT = 'The cat naps in the sun. It chases red butterflies. The bowl stays full.';

/**
 * Target-side span at chosen offsets over the fixture text.
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
 * Adjudicated single-claim issue with chosen status and spans.
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
          },);
        },).toThrow(EnvelopeOverlapError,);
      },
    },),
  ],
},);
