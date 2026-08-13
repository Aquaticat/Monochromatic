/**
 * Tests for enumerating the claims a disinterested judge may re-examine.
 *
 * The cases that matter are the ones that would shrink a denominator without
 * looking like it: a claim the whole roster proposed, a claim an issue names
 * that attribution never covered, and an entry settled before attribution
 * existed. Each is a real shape in the current run's artifacts, and each would
 * lift every rate above it if it silently vanished.
 *
 * Entry ids and claim ids are invented and cat-themed. No corpus text is
 * involved. Model ids are the real roster, because the rule under test is about
 * the relationship between authorship and the seats left over.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { buildCrosscheckCensus, } from '../../dist/final/node/index.mjs';

/**
 * Roster the census seats judges from, which is the shipped one.
 */
const ROSTER = [
  'hf:zai-org/GLM-5.2',
  'hf:zai-org/GLM-4.7-Flash',
  'hf:Qwen/Qwen3.6-27B',
  'hf:moonshotai/Kimi-K3',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
] as const;

/**
 * Builds one chunk record carrying the given attributions.
 *
 * @param claims - claim id paired with its proposing model ids
 *
 * @returns Chunk view shaped as the artifact carries it
 *
 * @example
 * ```ts
 * const chunk = chunkWith({ claims: [['issue/whisker', ['hf:zai-org/GLM-5.2',],],], },);
 * ```
 */
function chunkWith(
  { claims, }: { readonly claims: readonly (readonly [string, readonly string[],])[]; },
) {
  return {
    chunkIndex: 0,
    heardCriticIds: [...ROSTER,],
    claimAttributions: claims.map(function toAttribution([claimId, proposers,],) {
      return {
        claimId,
        // One emission each. The census never reads the count, but the view
        // carries it and the decoder rejects anything below one, so fixtures
        // that omitted it would be shapes no artifact can hold.
        proposers: proposers.map(function toProposer(modelId,) {
          return {
            modelId,
            emissionCount: 1,
          };
        },),
      };
    },),
  };
}

await describe({
  name: buildCrosscheckCensus.name,
  children: [
    it({
      name: 'seats every model that did not propose the claim, and splits '
        + 'accepted from not-accepted into the two arms the reading compares',
      fn: async () => {
        const census = buildCrosscheckCensus({
          entries: [
            {
              id: 'Whiskers',
              chunkCritics: [
                chunkWith({
                  claims: [
                    ['issue/mackerel', ['hf:zai-org/GLM-5.2',],],
                    ['issue/sardine', ['hf:openai/gpt-oss-120b',],],
                  ],
                },),
              ],
              issues: [
                {
                  status: 'accepted',
                  claimIds: ['issue/mackerel',],
                },
                {
                  status: 'rejected',
                  claimIds: ['issue/sardine',],
                },
              ],
            },
          ],
          roster: ROSTER,
        },);

        expect(census.items.length,).toBe(2,);
        expect(census.unjudgeable.length,).toBe(0,);

        const [accepted, control,] = census.items;
        expect(accepted?.arm,).toBe('accepted',);
        expect(control?.arm,).toBe('control',);

        // The author is barred and the other five are seated, which is the
        // common case: sole authorship covered 298 of 299 attributed claims.
        expect(accepted?.judges.length,).toBe(ROSTER.length - 1,);
        expect(accepted?.judges.includes('hf:zai-org/GLM-5.2',),).toBe(false,);
        expect(accepted?.barred,).toEqual(['hf:zai-org/GLM-5.2',],);
      },
    },),

    it({
      name: 'folds needs-human and source-defect into the control arm, since '
        + 'the arm needs claims the panel did not accept rather than a '
        + 'particular reason for not accepting',
      fn: async () => {
        const census = buildCrosscheckCensus({
          entries: [
            {
              id: 'Mittens',
              chunkCritics: [
                chunkWith({
                  claims: [
                    ['issue/tuna', ['hf:Qwen/Qwen3.6-27B',],],
                    ['issue/salmon', ['hf:Qwen/Qwen3.6-27B',],],
                  ],
                },),
              ],
              issues: [
                {
                  status: 'needs-human',
                  claimIds: ['issue/tuna',],
                },
                {
                  status: 'source-defect',
                  claimIds: ['issue/salmon',],
                },
              ],
            },
          ],
          roster: ROSTER,
        },);

        expect(census.items.map(function toArm(item,) {
          return item.arm;
        },),).toEqual(['control', 'control',],);

        // Status is kept verbatim beside the arm so a control result can be
        // broken down by reason without re-reading artifacts.
        expect(census.items.map(function toStatus(item,) {
          return item.status;
        },),).toEqual(['needs-human', 'source-defect',],);
      },
    },),

    it({
      name: 'reports a claim the whole roster proposed instead of dropping it, '
        + 'which is the exclusion that would lift every rate while looking '
        + 'entirely ordinary',
      fn: async () => {
        const census = buildCrosscheckCensus({
          entries: [
            {
              id: 'Tabby',
              chunkCritics: [
                chunkWith({
                  claims: [
                    ['issue/unanimous', [...ROSTER,],],
                    ['issue/ordinary', ['hf:moonshotai/Kimi-K3',],],
                  ],
                },),
              ],
              issues: [
                {
                  status: 'accepted',
                  claimIds: ['issue/unanimous', 'issue/ordinary',],
                },
              ],
            },
          ],
          roster: ROSTER,
        },);

        expect(census.items.length,).toBe(1,);
        expect(census.unjudgeable.length,).toBe(1,);
        expect(census.unjudgeable[0]?.claimId,).toBe('issue/unanimous',);
        expect(census.unjudgeable[0]?.barred.length,).toBe(ROSTER.length,);

        // The whole population is still accounted for. Were the unjudgeable
        // claim merely filtered away, this sum would read 1 and a rate over it
        // would be computed against a denominator missing the single most
        // corroborated claim in the entry.
        expect(census.items.length + census.unjudgeable.length,).toBe(2,);
      },
    },),

    it({
      name: 'reports a claim missing from an ATTRIBUTED entry as a join '
        + 'failure rather than as a legacy claim, since on an entry whose '
        + 'critics were attributed every surviving claim should have a '
        + 'proposer and folding it in would hide a broken join',
      fn: async () => {
        const census = buildCrosscheckCensus({
          entries: [
            {
              id: 'Calico',
              chunkCritics: [
                chunkWith({ claims: [['issue/known', ['hf:zai-org/GLM-5.2',],],], },),
              ],
              issues: [
                {
                  status: 'accepted',
                  claimIds: ['issue/known', 'issue/orphaned',],
                },
              ],
            },
          ],
          roster: ROSTER,
        },);

        expect(census.items.length,).toBe(1,);
        expect(census.unattributedJoinFailures,).toBe(1,);
        expect(census.unattributedLegacyClaims,).toBe(0,);
      },
    },),

    it({
      name: 'counts entries settled before attribution existed, which is 14 of '
        + 'the 19 in the current run and the reason the census covers a '
        + 'fraction of the accepted issues',
      fn: async () => {
        const census = buildCrosscheckCensus({
          entries: [
            {
              id: 'Ginger',
              issues: [
                {
                  status: 'accepted',
                  claimIds: ['issue/old',],
                },
              ],
            },
            {
              id: 'Sooty',
              chunkCritics: [
                chunkWith({ claims: [['issue/new', ['hf:openai/gpt-oss-120b',],],], },),
              ],
              issues: [
                {
                  status: 'accepted',
                  claimIds: ['issue/new',],
                },
              ],
            },
          ],
          roster: ROSTER,
        },);

        expect(census.entriesCovered,).toBe(2,);
        expect(census.entriesWithoutAttribution,).toBe(1,);
        expect(census.items.length,).toBe(1,);

        // The legacy entry's claim is expected absence, not a broken join, and
        // the two must stay apart: 1368 claims on this run sit in the legacy
        // count, so a join failure folded in with them would be invisible.
        expect(census.unattributedLegacyClaims,).toBe(1,);
        expect(census.unattributedJoinFailures,).toBe(0,);
      },
    },),

    it({
      name: 'lets a retired proposer bar nobody, since artifacts written before '
        + 'the 2026-08-05 roster change still name two ids the provider no '
        + 'longer serves',
      fn: async () => {
        const census = buildCrosscheckCensus({
          entries: [
            {
              id: 'Smudge',
              chunkCritics: [
                chunkWith({ claims: [['issue/legacy', ['hf:retired/model-that-left',],],], },),
              ],
              issues: [
                {
                  status: 'accepted',
                  claimIds: ['issue/legacy',],
                },
              ],
            },
          ],
          roster: ROSTER,
        },);

        expect(census.items[0]?.judges.length,).toBe(ROSTER.length,);
        expect(census.items[0]?.barred,).toEqual([],);
      },
    },),
  ],
},);
