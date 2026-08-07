/**
 * Tests for candidate selection: producer exclusion, the vote thresholds that
 * stop one judge deciding, and the two decline dispositions that tell an
 * unranked field apart from a rejected one.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  applyPatchOperations,
  type Candidate,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type EditableEnvelope,
  type EditorCandidate,
  hashContent,
  type PatchOutcome,
  selectBestCandidate,
  selectChunkPatch,
  selectPerEnvelope,
  type SyntheticClient,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Logger for the stages under test.
 */
const l = tagged({ tag: 'candidate-select-test', },);

/**
 * Original the judges compare against.
 */
const SOURCE_TEXT = '猫猫喜欢追蝴蝶。';

/**
 * Translation the envelopes are cut from.
 */
const TARGET_TEXT = 'The cat naps. The cat hates butterflies. The bowl stays full.';

/**
 * Region covering the planted mistranslation.
 */
const ENVELOPE: EditableEnvelope = {
  envelopeId: 'envelope/butterflies',
  startOffset: TARGET_TEXT.indexOf('The cat hates butterflies.',),
  endOffset: TARGET_TEXT.indexOf('The cat hates butterflies.',)
    + 'The cat hates butterflies.'.length,
  baseText: 'The cat hates butterflies.',
  baseHash: hashContent({ content: 'The cat hates butterflies.', },),
  issueIds: ['adjudicated/butterflies',],
};

/**
 * Ballots a scripted judge casts, keyed by model id.
 */
type BallotScript = Readonly<Record<string, number>>;

/**
 * Client answering every selection ballot from a script, and counting calls so
 * a test can prove a round never reached the judges.
 *
 * @param ballots - one-based candidate index per judge, zero to decline
 *
 * @param counter - mutable call tally the caller inspects afterwards
 *
 * @returns Client usable by the selection stage
 *
 * @example
 * ```ts
 * const client = scriptedJudges({ ballots, counter, },);
 * ```
 */
function scriptedJudges(
  {
    ballots,
    counter,
  }: {
    readonly ballots: BallotScript;
    readonly counter: { calls: number; };
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by candidate selection',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      counter.calls += 1;

      /**
       * Scripted ballot for the judge that was asked.
       */
      const scripted: unknown = {
        best: ballots[request.modelId] ?? 0,
        reason: 'scripted',
      };
      if (!request.validate(scripted,))
        throw new Error('stub script failed the ballot guard',);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by candidate selection',);
    },
  };
}

/**
 * Two competing string candidates from two named models.
 */
const STRING_CANDIDATES: readonly Candidate<string>[] = [
  {
    producer: {
      kind: 'model',
      modelId: 'hf:zai-org/GLM-5.2',
    },
    value: 'first',
    rendered: 'The cat chases butterflies.',
  },
  {
    producer: {
      kind: 'model',
      modelId: 'hf:Qwen/Qwen3.6-27B',
    },
    value: 'second',
    rendered: 'The cat loves chasing butterflies.',
  },
];

/**
 * Whole roster selection draws judges from.
 */
const JUDGES: readonly SyntheticModelId[] = [
  'hf:zai-org/GLM-5.2',
  'hf:Qwen/Qwen3.6-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Runs one selection round over the fixture candidates.
 *
 * @param ballots - one-based candidate index per judge
 *
 * @returns Outcome plus how many judge calls it took
 *
 * @example
 * ```ts
 * const { outcome, } = await runSelection({ ballots, },);
 * ```
 */
async function runSelection({ ballots, }: { readonly ballots: BallotScript; },) {
  /**
   * Judge calls the round made.
   */
  const counter = { calls: 0, };

  /**
   * Verdict over the fixture candidates.
   */
  const outcome = await selectBestCandidate({
    client: scriptedJudges({
      ballots,
      counter,
    },),
    candidates: STRING_CANDIDATES,
    judgeModelIds: JUDGES,
    task: 'Pick one.',
    criteria: ['Faithful.',],
    evidence: [
      {
        label: 'ORIGINAL',
        text: SOURCE_TEXT,
      },
    ],
    signal: new AbortController().signal,
    perCallTimeoutMs: 1_000,
    l,
  },);
  return {
    outcome,
    calls: counter.calls,
  };
}

await describe({
  name: selectBestCandidate.name,
  children: [
    it({
      name: 'never asks a model to judge a set containing its own candidate',
      fn: async () => {
        // Both producers vote for candidate 1; if either were consulted the
        // winner would draw more than the three disinterested votes.
        const { outcome, calls, } = await runSelection({
          ballots: {
            'hf:zai-org/GLM-5.2': 1,
            'hf:Qwen/Qwen3.6-27B': 1,
            'hf:moonshotai/Kimi-K3': 2,
            'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': 2,
            'hf:openai/gpt-oss-120b': 2,
          },
        },);
        expect(calls,).toBe(3,);
        expect(outcome.kind,).toBe('selected',);
        expect(outcome.kind === 'selected' ? outcome.value : '',).toBe('second',);
        expect(outcome.kind === 'selected' ? outcome.votes : 0,).toBe(3,);
        expect(outcome.tally.judgesAvailable,).toBe(3,);
      },
    },),

    it({
      name: 'declines when the leader draws a single vote, so a lone judge '
        + 'cannot decide the stage by itself',
      fn: async () => {
        // One judge names a candidate, the other two abstain. A plurality of
        // one is one model in control, which is the thing the ensemble exists
        // to prevent.
        const { outcome, } = await runSelection({
          ballots: {
            'hf:moonshotai/Kimi-K3': 1,
            'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': 0,
            'hf:openai/gpt-oss-120b': 0,
          },
        },);
        expect(outcome.kind,).toBe('declined',);
        expect(outcome.kind === 'declined' ? outcome.reason : '',).toBe(
          'winner short of the minimum vote count',
        );
        expect(outcome.kind === 'declined' ? outcome.disposition : '',).toBe('indecision',);
        expect(outcome.tally.abstentions,).toBe(2,);
      },
    },),

    it({
      name: 'reads a tie as indecision, not as a verdict against the candidates',
      fn: async () => {
        const { outcome, } = await runSelection({
          ballots: {
            'hf:moonshotai/Kimi-K3': 1,
            'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': 2,
            'hf:openai/gpt-oss-120b': 0,
          },
        },);
        expect(outcome.kind,).toBe('declined',);
        expect(outcome.kind === 'declined' ? outcome.reason : '',).toBe('judges tied',);
        expect(outcome.kind === 'declined' ? outcome.disposition : '',).toBe('indecision',);
      },
    },),

    it({
      name: 'reads unanimous refusal as a rejection, a substantive verdict '
        + 'rather than a failure to rank',
      fn: async () => {
        const { outcome, } = await runSelection({
          ballots: {
            'hf:moonshotai/Kimi-K3': 0,
            'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': 0,
            'hf:openai/gpt-oss-120b': 0,
          },
        },);
        expect(outcome.kind,).toBe('declined',);
        expect(outcome.kind === 'declined' ? outcome.reason : '',).toBe('every judge declined',);
        expect(outcome.kind === 'declined' ? outcome.disposition : '',).toBe('rejection',);
      },
    },),

    it({
      name: 'counts a ballot naming a candidate that does not exist as an '
        + 'abstention rather than discarding it',
      fn: async () => {
        const { outcome, } = await runSelection({
          ballots: {
            'hf:moonshotai/Kimi-K3': 2,
            'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': 2,
            'hf:openai/gpt-oss-120b': 9,
          },
        },);
        expect(outcome.kind,).toBe('selected',);
        expect(outcome.tally.abstentions,).toBe(1,);
        expect(outcome.tally.ballots,).toBe(3,);
      },
    },),
  ],
},);

/**
 * Builds one editor candidate proposing a replacement for the fixture
 * envelope.
 *
 * @param modelId - proposing model
 *
 * @param newText - replacement it proposed
 *
 * @returns Candidate carrying the gated patch
 *
 * @example
 * ```ts
 * const candidate = candidateFor({ modelId, newText, },);
 * ```
 */
function candidateFor(
  {
    modelId,
    newText,
  }: {
    readonly modelId: SyntheticModelId;
    readonly newText: string;
  },
): EditorCandidate {
  return {
    modelId,
    patch: applyPatchOperations({
      targetText: TARGET_TEXT,
      envelopes: [ENVELOPE,],
      operations: [
        {
          envelopeId: ENVELOPE.envelopeId,
          baseHash: ENVELOPE.baseHash,
          newText,
        },
      ],
    },),
  };
}

await describe({
  name: selectPerEnvelope.name,
  children: [
    it({
      name: 'adopts a sole proposal without spending a judge call, since there '
        + 'is nothing to compare it against',
      fn: async () => {
        /** Judge calls the pass made. */
        const counter = { calls: 0, };

        /** Composite over one editor's single proposal. */
        const selection = await selectPerEnvelope({
          client: scriptedJudges({
            ballots: {},
            counter,
          },),
          candidates: [
            candidateFor({
              modelId: 'hf:zai-org/GLM-5.2',
              newText: 'The cat chases butterflies.',
            },),
          ],
          envelopes: [ENVELOPE,],
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(counter.calls,).toBe(0,);
        expect(selection.soleCount,).toBe(1,);
        expect(selection.judgedCount,).toBe(0,);
        expect(selection.operations.length,).toBe(1,);
        expect([...selection.contributors,],).toEqual(['hf:zai-org/GLM-5.2',],);
      },
    },),

    it({
      name: 'leaves an envelope unedited when judges decline it, and credits '
        + 'no contributor for it',
      fn: async () => {
        /** Judge calls the pass made. */
        const counter = { calls: 0, };

        /** Composite over two competing proposals every judge refuses. */
        const selection = await selectPerEnvelope({
          client: scriptedJudges({
            ballots: {},
            counter,
          },),
          candidates: [
            candidateFor({
              modelId: 'hf:zai-org/GLM-5.2',
              newText: 'The cat chases butterflies.',
            },),
            candidateFor({
              modelId: 'hf:Qwen/Qwen3.6-27B',
              newText: 'The cat loves chasing butterflies.',
            },),
          ],
          envelopes: [ENVELOPE,],
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(counter.calls,).toBeGreaterThan(0,);
        expect(selection.declinedCount,).toBe(1,);
        expect(selection.operations.length,).toBe(0,);
        expect(selection.contributors.length,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: selectChunkPatch.name,
  children: [
    it({
      name: 'ships the strongest repair when judges fail to rank, because a '
        + 'disagreement about wording is not a verdict against repairing',
      fn: async () => {
        /** Repair kept when judges cannot converge. */
        const indecisionFallback: PatchOutcome = candidateFor({
          modelId: 'hf:zai-org/GLM-5.2',
          newText: 'The cat chases butterflies.',
        },).patch;

        /** Untouched chunk, reserved for an outright rejection. */
        const rejectionFallback: PatchOutcome = {
          patchedText: TARGET_TEXT,
          applied: [],
          rejected: [],
        };

        /** Judge calls the pass made. */
        const counter = { calls: 0, };

        /** Verdict over two candidates the judges tie on. */
        const patch = await selectChunkPatch({
          client: scriptedJudges({
            ballots: {
              'hf:moonshotai/Kimi-K3': 1,
              'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4': 2,
              'hf:openai/gpt-oss-120b': 0,
            },
            counter,
          },),
          candidates: STRING_CANDIDATES.map(function toPatchCandidate(
            candidate,
            index,
          ): Candidate<PatchOutcome> {
            return {
              producer: candidate.producer,
              value: candidateFor({
                modelId: candidate.producer.kind === 'model'
                  ? candidate.producer.modelId
                  : 'hf:zai-org/GLM-5.2',
                newText: `Replacement ${String(index + 1,)}.`,
              },).patch,
              rendered: candidate.rendered,
            };
          },),
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          indecisionFallback,
          rejectionFallback,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(patch.patchedText,).toContain('The cat chases butterflies.',);
        expect(patch.applied.length,).toBe(1,);
      },
    },),

    it({
      name: 'ships no repair when every judge refuses, rather than overruling '
        + 'a verdict that none of the candidates is good enough',
      fn: async () => {
        /** Repair that must NOT ship over an outright rejection. */
        const indecisionFallback: PatchOutcome = candidateFor({
          modelId: 'hf:zai-org/GLM-5.2',
          newText: 'The cat chases butterflies.',
        },).patch;

        /** Untouched chunk. */
        const rejectionFallback: PatchOutcome = {
          patchedText: TARGET_TEXT,
          applied: [],
          rejected: [],
        };

        /** Judge calls the pass made. */
        const counter = { calls: 0, };

        /** Verdict over candidates every judge refuses. */
        const patch = await selectChunkPatch({
          client: scriptedJudges({
            ballots: {},
            counter,
          },),
          candidates: STRING_CANDIDATES.map(function toPatchCandidate(
            candidate,
            index,
          ): Candidate<PatchOutcome> {
            return {
              producer: candidate.producer,
              value: candidateFor({
                modelId: candidate.producer.kind === 'model'
                  ? candidate.producer.modelId
                  : 'hf:zai-org/GLM-5.2',
                newText: `Replacement ${String(index + 1,)}.`,
              },).patch,
              rendered: candidate.rendered,
            };
          },),
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          indecisionFallback,
          rejectionFallback,
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(patch.patchedText,).toBe(TARGET_TEXT,);
        expect(patch.applied.length,).toBe(0,);
      },
    },),

    it({
      name: 'ships a sole surviving candidate unjudged, since deduplication '
        + 'means every editor and the composite wrote the same text',
      fn: async () => {
        /** Judge calls the pass made. */
        const counter = { calls: 0, };

        /** Text every proposal agreed on. */
        const agreed = candidateFor({
          modelId: 'hf:zai-org/GLM-5.2',
          newText: 'The cat chases butterflies.',
        },).patch;

        /** Verdict over the one distinct candidate. */
        const patch = await selectChunkPatch({
          client: scriptedJudges({
            ballots: {},
            counter,
          },),
          candidates: [
            {
              producer: {
                kind: 'composite',
                contributors: [
                  'hf:zai-org/GLM-5.2',
                  'hf:Qwen/Qwen3.6-27B',
                ],
              },
              value: agreed,
              rendered: agreed.patchedText,
            },
          ],
          judgeModelIds: JUDGES,
          sourceText: SOURCE_TEXT,
          indecisionFallback: agreed,
          rejectionFallback: {
            patchedText: TARGET_TEXT,
            applied: [],
            rejected: [],
          },
          signal: new AbortController().signal,
          perCallTimeoutMs: 1_000,
          l,
        },);
        expect(counter.calls,).toBe(0,);
        expect(patch.patchedText,).toContain('The cat chases butterflies.',);
      },
    },),
  ],
},);
