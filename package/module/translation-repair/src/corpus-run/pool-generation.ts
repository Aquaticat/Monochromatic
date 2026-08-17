import type { SampleGeneration, } from '../sample-manifest.ts';

import type { EligibleEntries, } from './artifact-eligible.ts';

//region Pool generation
// Which built pipeline a draw's pool was settled under, in the shape the sample
// manifest records.
//
// ITS OWN MODULE because it bridges two of them: eligibility knows which
// entries a pool kept and what each recorded, and the manifest knows how a
// generation is written down. Putting it in either would make that one import
// the other for a single function, and `artifact-eligible.ts` was already at its
// line budget.
//
// `#60` names the gap this closes: `EligibleEntries` has carried `selection`,
// `tipByEntry` and `digestByEntry` for some time while the manifest wrote none
// of them, so a graded sheet could not say which pipeline produced the entries
// it was drawn from.

/**
 * Names the one built pipeline a pool's kept entries were settled under.
 *
 * ONE DIGEST FOR THE POOL. `selectEligible` and the pool guards refuse a
 * directory holding two generations before a draw can reach it, so every kept
 * entry carries the same digest by construction. Disagreement here would mean
 * that guard had failed, which is worth reporting as an absence rather than
 * silently taking the first.
 *
 * @param eligible - what the pool resolved to
 *
 * @param names - artifact file names the draw actually kept
 *
 * @returns Recorded generation, or why one could not be named
 *
 * @example
 * ```ts
 * const generation = poolGeneration({ eligible, names, },);
 * ```
 */
export function poolGeneration(
  {
    eligible,
    names,
  }: {
    readonly eligible: EligibleEntries;
    readonly names: readonly string[];
  },
): SampleGeneration {
  /**
   * Digests the kept entries record, deduplicated.
   */
  const digests = [
    ...new Set(
      names
        .map(function digestOf(name,): string {
          /**
           * Digest this entry recorded, empty when it recorded none.
           */
          const recorded = eligible.digestByEntry
            .get(name,);
          return recorded ?? '';
        },)
        .filter(function isKnown(digest,): boolean {
          return digest !== '';
        },),
    ),
  ];

  if (digests.length === 0)
    return {
      kind: 'unrecorded',
      reason: 'no kept entry recorded a pipeline digest',
    };

  if (digests.length > 1)
    return {
      kind: 'unrecorded',
      reason: `pool holds ${String(digests.length,)} generations, which the pool guard should have refused`,
    };

  return {
    kind: 'recorded',
    digest: digests[0] ?? '',
    entries: names.length,
  };
}

//endregion Pool generation
