/**
 * Tests the evidence lines the lane contest is shown from the
 * introduced-defect probe.
 *
 * THE CASE IS keyword233, 2026-09-03: two probers corroborated that the repair
 * editor had moved a deceased person's paragraph into the present tense, the
 * repair shipped as the design says, and the lane contest chose it 7 of 7
 * without ever seeing the claim. Here only corroborated claims become lines,
 * keyed by the slice they concern, and a chunk with none contributes nothing.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  damageClaimLinesBySlice,
  type RegionDefectTally,
  type ScreenedDefectClaim,
} from '../dist/final/node/index.mjs';

/**
 * Builds one screened claim with the given admissibility.
 *
 * @param admissibility - what the deterministic check made of the quote
 *
 * @param evidence - wording quoted from the repair text
 *
 * @param category - defect class in the prober's words
 *
 * @returns Claim as the screen records it
 *
 * @example
 * ```ts
 * const claim = claimOf({ admissibility: 'corroborated', evidence: 'is', },);
 * ```
 */
function claimOf(
  {
    admissibility,
    evidence,
    category = 'tense',
  }: {
    readonly admissibility: ScreenedDefectClaim['admissibility'];
    readonly evidence: string;
    readonly category?: string;
  },
): ScreenedDefectClaim {
  return {
    modelId: 'hf:moonshotai/Kimi-K3',
    category,
    severity: 'moderate',
    evidence,
    omittedText: '',
    reason: 'the page holds past tense',
    admissibility,
  };
}

/**
 * Region tally around a set of claims, counts derived from them.
 *
 * @param claims - screened claims
 *
 * @returns Tally as the probe records it
 *
 * @example
 * ```ts
 * const region = regionOf({ claims: [claimOf({ admissibility: 'corroborated', evidence: 'is', },),], },);
 * ```
 */
function regionOf(
  { claims, }: { readonly claims: readonly ScreenedDefectClaim[]; },
): RegionDefectTally {
  return {
    envelopeId: 'envelope/1',
    issueIds: ['issue/1',],
    corroborated: claims.filter((claim,) => claim.admissibility === 'corroborated',).length,
    removalCorroborated: 0,
    contradicted: claims.filter((claim,) => claim.admissibility === 'contradicted',).length,
    unanchored: claims.filter((claim,) => claim.admissibility === 'unanchored',).length,
    preExisting: 0,
    noneFound: 0,
    uncertain: 0,
    claims,
  };
}

await describe({
  name: damageClaimLinesBySlice.name,
  children: [
    it({
      name: 'RENDERS only corroborated claims, one line each, keyed by the slice they concern, and '
        + 'LEAVES OUT chunks whose claims all failed the screen or that were never probed',
      fn: async () => {
        const bySlice = damageClaimLinesBySlice({
          lane: { chunks: [
            {
              sliceIndex: 1,
              introducedDefects: {
                regions: [
                  regionOf({
                    claims: [
                      claimOf({ admissibility: 'corroborated', evidence: 'is a transgender woman', },),
                      claimOf({ admissibility: 'contradicted', evidence: 'was', },),
                    ],
                  },),
                  regionOf({
                    claims: [
                      claimOf({ admissibility: 'corroborated', evidence: 'where she shares', category: '', },),
                    ],
                  },),
                ],
              },
            },
            {
              sliceIndex: 2,
              introducedDefects: {
                regions: [
                  regionOf({ claims: [claimOf({ admissibility: 'unanchored', evidence: 'nowhere', },),], },),
                ],
              },
            },
            { sliceIndex: 3, },
          ], },
        },);
        expect([...bySlice.keys(),],).toEqual([1,],);
        expect(bySlice.get(1,),).toEqual([
          '- hf:moonshotai/Kimi-K3 [tense] quotes "is a transgender woman": the page holds past tense',
          '- hf:moonshotai/Kimi-K3 [unspecified] quotes "where she shares": the page holds past tense',
        ],);
        expect(damageClaimLinesBySlice({ lane: { chunks: [], }, },).size,).toBe(0,);
      },
    },),
  ],
},);
