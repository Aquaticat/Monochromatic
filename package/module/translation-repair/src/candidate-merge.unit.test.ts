/**
 * Tests for collapsing identical candidates while keeping every author.
 *
 * The defect these exist for is silent in every log: when duplicates stand as
 * separate candidates, the ballot splits and the self-vote discount stops
 * applying, because each copy is credited to one model and the others look
 * disinterested in text they wrote themselves.
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
  type Candidate,
  mergeIdenticalCandidates,
  producerModelIds,
  type SyntheticModelId,
} from '../dist/final/node/index.mjs';

/**
 * Text two models happened to write identically.
 */
const SHARED = 'The cat naps on the windowsill.';

/**
 * A different rendering of the same passage.
 */
const OTHER = 'The cat is napping on the windowsill.';

/**
 * Builds one model's candidate.
 *
 * @param modelId - model credited with it
 *
 * @param text - what it wrote
 *
 * @returns Candidate as a lane would assemble it
 *
 * @example
 * ```ts
 * const candidate = from({ modelId: 'hf:x', text: SHARED, },);
 * ```
 */
function from(
  {
    modelId,
    text,
  }: {
    readonly modelId: SyntheticModelId;
    readonly text: string;
  },
): Candidate<string> {
  return {
    producer: {
      kind: 'model',
      modelId,
    },
    value: text,
    rendered: text,
  };
}

await describe({
  name: mergeIdenticalCandidates.name,
  children: [
    it({
      name: 'CREDITS every model that wrote the same text to one candidate, '
        + 'which is what makes a later ballot for it count as that model\'s own '
        + 'work. Dropping the second author instead left the discount silently '
        + 'inapplicable on exactly the slices where the ensemble agreed',
      fn: async () => {
        const merged = mergeIdenticalCandidates({
          candidates: [
            from({
              modelId: 'hf:zai-org/GLM-5.2',
              text: SHARED,
            },),
            from({
              modelId: 'hf:Qwen/Qwen3.6-27B',
              text: SHARED,
            },),
          ],
        },);
        expect(merged,).toHaveLength(1,);
        expect(producerModelIds(merged[0]?.producer
          ?? {
            kind: 'model',
            modelId: 'hf:openai/gpt-oss-120b',
          },),)
          .toEqual([
            'hf:zai-org/GLM-5.2',
            'hf:Qwen/Qwen3.6-27B',
          ],);
      },
    },),

    it({
      name: 'keeps distinct proposals apart and in FIRST-SEEN order, since the '
        + 'lane assembling them puts them in roster order and candidate '
        + 'numbering must not vary between runs over identical inputs',
      fn: async () => {
        const merged = mergeIdenticalCandidates({
          candidates: [
            from({
              modelId: 'hf:zai-org/GLM-5.2',
              text: OTHER,
            },),
            from({
              modelId: 'hf:Qwen/Qwen3.6-27B',
              text: SHARED,
            },),
            from({
              modelId: 'hf:moonshotai/Kimi-K3',
              text: OTHER,
            },),
          ],
        },);
        expect(merged,).toHaveLength(2,);
        expect(merged[0]?.rendered,).toBe(OTHER,);
        expect(merged[1]?.rendered,).toBe(SHARED,);
      },
    },),

    it({
      name: 'returns nothing for no candidates, which is a stage whose whole '
        + 'roster was lost rather than a fault',
      fn: async () => {
        expect(mergeIdenticalCandidates({ candidates: [], },),).toEqual([],);
      },
    },),
  ],
},);
