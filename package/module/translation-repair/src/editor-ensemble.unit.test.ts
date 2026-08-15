/**
 * Tests for the editor ensemble: candidate assembly, producer provenance,
 * roster invariants, judge prompt fencing, and the two decline dispositions.
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
  applyPatchOperations,
  assertCheckerIndependence,
  assertJudgeableEditorRoster,
  buildCandidateSelectMessages,
  buildChunkCandidates,
  type CandidateProducer,
  CheckerIndependenceError,
  describeProducer,
  type EditableEnvelope,
  type EditorCandidate,
  ProducerRosterError,
  hashContent,
  mergeProducers,
  type PatchOutcome,
  pickFallbackPatch,
  producerModelIds,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

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
 * Builds one editor candidate proposing a replacement for the fixture
 * envelope, so tests differ only in who proposed what.
 *
 * @param modelId - proposing model
 *
 * @param newText - replacement it proposed
 *
 * @returns Candidate carrying the gated patch
 *
 * @example
 * ```ts
 * const candidate = candidateFor({ modelId: 'hf:zai-org/GLM-5.2', newText, },);
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
      preservation: { mode: 'skip', },
    },),
  };
}

/**
 * Apply-gate outcome that repairs nothing, standing for the untouched chunk.
 */
const EMPTY_PATCH: PatchOutcome = {
  patchedText: TARGET_TEXT,
  applied: [],
  rejected: [],
};

await describe({
  name: mergeProducers.name,
  children: [
    it({
      name: 'unions the stakes of two models, keeps a single model singular, '
        + 'and preserves first-seen order through a composite',
      fn: async () => {
        /** Two distinct models writing identical text. */
        const both = mergeProducers({
          left: {
            kind: 'model',
            modelId: 'hf:zai-org/GLM-5.2',
          },
          right: {
            kind: 'model',
            modelId: 'hf:Qwen/Qwen3.6-27B',
          },
        },);
        expect(both.kind,).toBe('composite',);
        expect([...producerModelIds(both,),],).toEqual([
          'hf:zai-org/GLM-5.2',
          'hf:Qwen/Qwen3.6-27B',
        ],);

        // One model named twice is still one stakeholder, not a pair.
        /** Same model on both sides. */
        const same = mergeProducers({
          left: {
            kind: 'model',
            modelId: 'hf:zai-org/GLM-5.2',
          },
          right: {
            kind: 'model',
            modelId: 'hf:zai-org/GLM-5.2',
          },
        },);
        expect(same.kind,).toBe('model',);
        expect([...producerModelIds(same,),],).toEqual(['hf:zai-org/GLM-5.2',],);

        /** Composite absorbing a model already among its contributors. */
        const widened = mergeProducers({
          left: {
            kind: 'composite',
            contributors: [
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.6-27B',
            ],
          },
          right: {
            kind: 'model',
            modelId: 'hf:moonshotai/Kimi-K3',
          },
        },);
        expect([...producerModelIds(widened,),],).toEqual([
          'hf:zai-org/GLM-5.2',
          'hf:Qwen/Qwen3.6-27B',
          'hf:moonshotai/Kimi-K3',
        ],);
      },
    },),

    it({
      name: 'describes a composite by its contributors rather than one model',
      fn: async () => {
        /** Stitched provenance. */
        const producer: CandidateProducer = {
          kind: 'composite',
          contributors: [
            'hf:zai-org/GLM-5.2',
            'hf:Qwen/Qwen3.6-27B',
          ],
        };
        expect(describeProducer(producer,),).toBe(
          'composite(hf:zai-org/GLM-5.2 + hf:Qwen/Qwen3.6-27B)',
        );
        expect(
          describeProducer({
            kind: 'model',
            modelId: 'hf:zai-org/GLM-5.2',
          },),
        ).toBe('hf:zai-org/GLM-5.2',);
      },
    },),
  ],
},);

await describe({
  name: buildChunkCandidates.name,
  children: [
    it({
      name: 'keeps distinct proposals apart and counts no collapse',
      fn: async () => {
        /** Two editors disagreeing on the wording. */
        const set = buildChunkCandidates({
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
          composite: EMPTY_PATCH,
          contributors: [],
        },);
        expect(set.candidates.length,).toBe(2,);
        expect(set.collapsed,).toBe(0,);
      },
    },),

    it({
      name: 'drops a composite that repairs nothing rather than offering the '
        + 'untouched translation as a candidate',
      fn: async () => {
        /** Composite assembled from no winning operation. */
        const set = buildChunkCandidates({
          candidates: [
            candidateFor({
              modelId: 'hf:zai-org/GLM-5.2',
              newText: 'The cat chases butterflies.',
            },),
          ],
          composite: EMPTY_PATCH,
          contributors: [],
        },);
        expect(set.candidates.length,).toBe(1,);
        expect(
          set.candidates.every(function repairsSomething(candidate,) {
            return candidate.value
              .applied
              .length
              > 0;
          },),
        ).toBe(true,);
      },
    },),

    it({
      name: 'collapses identical text and unions every stake, so no producer '
        + 'is freed to judge its own words',
      fn: async () => {
        /** Wording both editors and the composite arrived at. */
        const agreed = 'The cat chases butterflies.';

        /** Composite carrying only the second editor as contributor. */
        const composite = applyPatchOperations({
          targetText: TARGET_TEXT,
          envelopes: [ENVELOPE,],
          operations: [
            {
              envelopeId: ENVELOPE.envelopeId,
              baseHash: ENVELOPE.baseHash,
              newText: agreed,
            },
          ],
          preservation: { mode: 'skip', },
        },);

        /** One editor patch plus an identical composite from another model. */
        const set = buildChunkCandidates({
          candidates: [
            candidateFor({
              modelId: 'hf:zai-org/GLM-5.2',
              newText: agreed,
            },),
          ],
          composite,
          contributors: ['hf:Qwen/Qwen3.6-27B',],
        },);
        expect(set.candidates.length,).toBe(1,);
        expect(set.collapsed,).toBe(1,);

        /** Survivor of the collapse. */
        const [survivor,] = set.candidates;
        expect(survivor,).toBeDefined();

        /** Everyone with a stake in the surviving text. */
        const stakes = new Set(producerModelIds(
          survivor?.producer ?? {
            kind: 'composite',
            contributors: [],
          },
        ));
        // Both the editor whose candidate survived and the composite's
        // contributor must stay barred; dropping either lets that model judge
        // text it wrote.
        expect(stakes.has('hf:zai-org/GLM-5.2',),).toBe(true,);
        expect(stakes.has('hf:Qwen/Qwen3.6-27B',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: pickFallbackPatch.name,
  children: [
    it({
      name: 'prefers the editor that landed more operations',
      fn: async () => {
        /** Editor landing nothing, because its replacement was a no-op. */
        const idle = candidateFor({
          modelId: 'hf:zai-org/GLM-5.2',
          newText: ENVELOPE.baseText,
        },);

        /** Editor landing a real replacement. */
        const working = candidateFor({
          modelId: 'hf:Qwen/Qwen3.6-27B',
          newText: 'The cat chases butterflies.',
        },);
        expect(idle.patch
          .applied
          .length,).toBe(0,);
        expect(
          pickFallbackPatch({
            candidates: [
              idle,
              working,
            ],
          },).patchedText,
        ).toContain('The cat chases butterflies.',);
      },
    },),

    it({
      name: 'breaks a tie on applied count by roster order, not by wording',
      fn: async () => {
        /** Two editors each landing exactly one operation. */
        const first = candidateFor({
          modelId: 'hf:zai-org/GLM-5.2',
          newText: 'The cat chases butterflies.',
        },);

        /** Later editor in roster order. */
        const second = candidateFor({
          modelId: 'hf:Qwen/Qwen3.6-27B',
          newText: 'The cat loves chasing butterflies.',
        },);
        expect(
          pickFallbackPatch({
            candidates: [
              first,
              second,
            ],
          },).patchedText,
        ).toContain('The cat chases butterflies.',);
        // Reversing the roster reverses the winner, proving order decides
        // rather than anything about the text.
        expect(
          pickFallbackPatch({
            candidates: [
              second,
              first,
            ],
          },).patchedText,
        ).toContain('The cat loves chasing butterflies.',);
      },
    },),
  ],
},);

await describe({
  name: assertJudgeableEditorRoster.name,
  children: [
    it({
      name: 'passes a roster with enough disinterested judges',
      fn: async () => {
        assertJudgeableEditorRoster({
          editorModelIds: ['hf:moonshotai/Kimi-K3',],
          judgeModelIds: [
            'hf:moonshotai/Kimi-K3',
            'hf:zai-org/GLM-5.2',
            'hf:Qwen/Qwen3.6-27B',
          ],
        },);
      },
    },),

    it({
      name: 'ACCEPTS two editors judged by themselves and one other, which the '
        + 'old rule refused: two discounted ballots and one full one reach the '
        + 'minimum weight, so a decision is possible and the ruling of '
        + '2026-08-14 says a stake discounts an opinion rather than voiding it',
      fn: async () => {
        expect(function twoEditorsOneOutsider() {
          assertJudgeableEditorRoster({
            editorModelIds: [
              'hf:moonshotai/Kimi-K3',
              'hf:zai-org/GLM-5.2',
            ],
            judgeModelIds: [
              'hf:moonshotai/Kimi-K3',
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.6-27B',
            ],
          },);
        },).not.toThrow();
      },
    },),

    it({
      name: 'refuses a roster that could never reach the minimum weight, which '
        + 'would decline every round in silence: one editor grading itself '
        + 'draws half a vote, and a lone judge cannot decide a stage anyway',
      fn: async () => {
        expect(function everyJudgeEdits() {
          assertJudgeableEditorRoster({
            editorModelIds: ['hf:moonshotai/Kimi-K3',],
            judgeModelIds: ['hf:moonshotai/Kimi-K3',],
          },);
        },).toThrow(ProducerRosterError,);

        expect(function twoEditorsJudgingThemselves() {
          assertJudgeableEditorRoster({
            editorModelIds: [
              'hf:moonshotai/Kimi-K3',
              'hf:zai-org/GLM-5.2',
            ],
            judgeModelIds: [
              'hf:moonshotai/Kimi-K3',
              'hf:zai-org/GLM-5.2',
            ],
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),

    it({
      name: 'refuses repeated and empty editor rosters, since a repeated id is '
        + 'one model counted twice rather than an independent voice',
      fn: async () => {
        expect(function repeatedEditor() {
          assertJudgeableEditorRoster({
            editorModelIds: [
              'hf:moonshotai/Kimi-K3',
              'hf:moonshotai/Kimi-K3',
            ],
            judgeModelIds: [
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.6-27B',
            ],
          },);
        },).toThrow(ProducerRosterError,);

        expect(function noEditor() {
          assertJudgeableEditorRoster({
            editorModelIds: [],
            judgeModelIds: [
              'hf:zai-org/GLM-5.2',
              'hf:Qwen/Qwen3.6-27B',
            ],
          },);
        },).toThrow(ProducerRosterError,);
      },
    },),
  ],
},);

await describe({
  name: assertCheckerIndependence.name,
  children: [
    it({
      name: 'passes disjoint rosters and refuses a checker that also edits',
      fn: async () => {
        assertCheckerIndependence({
          editorModelIds: ['hf:moonshotai/Kimi-K3',],
          checkerModelIds: [
            'hf:zai-org/GLM-5.2',
            'hf:Qwen/Qwen3.6-27B',
          ],
        },);

        expect(function checksOwnWork() {
          assertCheckerIndependence({
            editorModelIds: ['hf:moonshotai/Kimi-K3',],
            checkerModelIds: [
              'hf:zai-org/GLM-5.2',
              'hf:moonshotai/Kimi-K3',
            ],
          },);
        },).toThrow(CheckerIndependenceError,);
      },
    },),
  ],
},);

await describe({
  name: buildCandidateSelectMessages.name,
  children: [
    it({
      name: 'fences candidates so a setext underline inside one cannot close '
        + 'its own block',
      fn: async () => {
        /** Candidate whose own text carries the default fence. */
        const messages = buildCandidateSelectMessages({
          task: 'Pick one.',
          criteria: ['Faithful.',],
          evidence: [
            {
              label: 'ORIGINAL',
              text: '猫猫喜欢追蝴蝶。',
            },
          ],
          rendered: [
            'A heading\n=====\nand its body.',
            'Plain replacement.',
          ],
        },);

        /** Judge-facing prompt. */
        const content = messages.at(-1,)?.content ?? '';
        // A five-character fence would be closed by the candidate's own
        // underline, so the chosen fence has to be longer.
        expect(content.includes('\n======\n',),).toBe(true,);
        expect(content.split('\n======\n',).length - 1,).toBeGreaterThan(1,);
      },
    },),

    it({
      name: 'outgrows any run of the fence character the content contains',
      fn: async () => {
        /** Candidate carrying a long run of the fence character. */
        const messages = buildCandidateSelectMessages({
          task: 'Pick one.',
          criteria: ['Faithful.',],
          evidence: [
            {
              label: 'ORIGINAL',
              text: '========== a source that also fences',
            },
          ],
          rendered: ['Plain replacement.',],
        },);

        /** Judge-facing prompt. */
        const content = messages.at(-1,)?.content ?? '';
        expect(content.includes('\n===========\n',),).toBe(true,);
      },
    },),

    it({
      name: 'labels every evidence block and numbers candidates from one',
      fn: async () => {
        /** Prompt over two evidence blocks. */
        const messages = buildCandidateSelectMessages({
          task: 'Pick one.',
          criteria: ['Faithful.',],
          evidence: [
            {
              label: 'ORIGINAL (Chinese)',
              text: '猫猫喜欢追蝴蝶。',
            },
            {
              label: 'PASSAGE BEING REPLACED (current English)',
              text: 'The cat hates butterflies.',
            },
          ],
          rendered: [
            'The cat chases butterflies.',
            'The cat loves chasing butterflies.',
          ],
        },);

        /** Judge-facing prompt. */
        const content = messages.at(-1,)?.content ?? '';
        expect(content.includes('ORIGINAL (Chinese)',),).toBe(true,);
        expect(content.includes('PASSAGE BEING REPLACED (current English)',),).toBe(true,);
        expect(content.includes('CANDIDATE 1',),).toBe(true,);
        expect(content.includes('CANDIDATE 2',),).toBe(true,);
        expect(content.includes('CANDIDATE 3',),).toBe(false,);
      },
    },),
  ],
},);
