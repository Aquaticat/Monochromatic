/**
 * Tests for the distinct replacements offered for one envelope.
 *
 * Provenance is the point: a duplicate proposal merges its author into the
 * survivor rather than being dropped, so a judge that wrote the words is
 * discounted for them however many others wrote the same. Fixtures are
 * cat-themed invention.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CandidateProducer,
  collectEnvelopeProposals,
  type EditableEnvelope,
  type EditorCandidate,
  hashContent,
  type RosterModelId,
} from '../dist/final/node/index.mjs';

/**
 * Text the envelope covers.
 */
const BASE_TEXT = 'The cat is doing the sleeping on the windowsill.';

/**
 * Envelope under decision.
 */
const ENVELOPE: EditableEnvelope = {
  envelopeId: 'envelope/cat',
  startOffset: 0,
  endOffset: BASE_TEXT.length,
  baseText: BASE_TEXT,
  baseHash: hashContent({ content: BASE_TEXT, },),
  issueIds: ['adjudicated/cat-tense',],
};

/**
 * Editor outcome proposing one replacement for the envelope, or nothing.
 *
 * @param modelId - editor
 *
 * @param newText - its replacement, absent when it left the envelope alone
 *
 * @returns Candidate as the stage records it
 *
 * @example
 * ```ts
 * const candidate = proposing({ modelId: 'hf:zai-org/GLM-5.3-Flash', newText: 'The cat sleeps.', },);
 * ```
 */
function proposing(
  {
    modelId,
    newText,
  }: {
    readonly modelId: RosterModelId;
    readonly newText?: string;
  },
): EditorCandidate {
  return {
    modelId,
    patch: {
      patchedText: newText ?? BASE_TEXT,
      applied: (newText === undefined)
        ? []
        : [
          {
            envelopeId: ENVELOPE.envelopeId,
            baseHash: ENVELOPE.baseHash,
            newText,
          },
        ],
      rejected: [],
    },
  };
}

/**
 * Every model a producer credits.
 *
 * @param producer - who a candidate is credited to
 *
 * @returns Model ids, in the producer's own order
 *
 * @example
 * ```ts
 * const models = creditedTo({ producer, },);
 * ```
 */
function creditedTo({ producer, }: { readonly producer: CandidateProducer; },): readonly string[] {
  if (producer.kind === 'model')
    return [producer.modelId,];
  if (producer.kind === 'composite')
    return producer.contributors;
  return producer.matched;
}

await describe({
  name: collectEnvelopeProposals.name,
  children: [
    it({
      name: 'MERGES a duplicate proposal into the first one, crediting both writers, so neither votes at '
        + 'full weight for words it wrote',
      fn: async () => {
        const proposals = collectEnvelopeProposals({
          candidates: [
            proposing({
              modelId: 'hf:zai-org/GLM-5.3-Flash',
              newText: 'The cat sleeps on the windowsill.',
            },),
            proposing({
              modelId: 'hf:moonshotai/Kimi-K3',
              newText: 'The cat sleeps on the windowsill.',
            },),
          ],
          envelope: ENVELOPE,
        },);

        expect(proposals.length,).toBe(1,);
        expect([...creditedTo({ producer: proposals[0]?.producer ?? { kind: 'incumbent', matched: [], }, },),]
          .toSorted(),).toEqual([
          'hf:moonshotai/Kimi-K3',
          'hf:zai-org/GLM-5.3-Flash',
        ],);
      },
    },),

    it({
      name: 'keeps distinct replacements apart, in roster order, each credited to its writer alone',
      fn: async () => {
        const proposals = collectEnvelopeProposals({
          candidates: [
            proposing({
              modelId: 'hf:zai-org/GLM-5.3-Flash',
              newText: 'The cat sleeps on the windowsill.',
            },),
            proposing({
              modelId: 'hf:moonshotai/Kimi-K3',
              newText: 'The cat naps on the windowsill.',
            },),
          ],
          envelope: ENVELOPE,
        },);

        expect(proposals.map(function toText(proposal,): string {
          return proposal.rendered;
        },),).toEqual([
          'The cat sleeps on the windowsill.',
          'The cat naps on the windowsill.',
        ],);
        expect(proposals.map(function toProducer(proposal,): readonly string[] {
          return creditedTo({ producer: proposal.producer, },);
        },),).toEqual([
          ['hf:zai-org/GLM-5.3-Flash',],
          ['hf:moonshotai/Kimi-K3',],
        ],);
      },
    },),

    it({
      name: 'contributes nothing for a model that left the envelope alone',
      fn: async () => {
        const proposals = collectEnvelopeProposals({
          candidates: [
            proposing({ modelId: 'hf:zai-org/GLM-5.3-Flash', },),
            proposing({
              modelId: 'hf:moonshotai/Kimi-K3',
              newText: 'The cat naps on the windowsill.',
            },),
          ],
          envelope: ENVELOPE,
        },);

        expect(proposals.length,).toBe(1,);
        expect(proposals[0]?.value.newText,).toBe('The cat naps on the windowsill.',);
      },
    },),
  ],
},);
