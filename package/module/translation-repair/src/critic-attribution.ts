import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Critic attribution
// Which critic raised which claim, kept OUTSIDE the claim because adjudication
// is provenance-blind and must stay that way: a real defect can arrive with
// exactly one proposer, so proposer counts may calibrate critics but must never
// influence acceptance. Keyed by the deterministic claim id, which claims
// already carry, so nothing here has to travel inside `IssueClaim`.

/**
 * One critic's contribution to one claim.
 *
 * @example
 * ```ts
 * const proposer: ClaimProposer = { modelId: 'hf:openai/gpt-oss-120b', emissionCount: 2, };
 * ```
 */
export type ClaimProposer = {
  /**
   * Critic that emitted this claim.
   */
  readonly modelId: SyntheticModelId;

  /**
   * How many times this critic emitted it within its own report;
   * separated from proposer count because one critic repeating itself is
   * self-repetition while two critics agreeing is independent support, and a
   * flat model list conflates exactly those two.
   */
  readonly emissionCount: number;
};

/**
 * Every critic behind one deduplicated claim.
 *
 * @example
 * ```ts
 * const attribution: ClaimAttribution = { claimId, proposers, };
 * ```
 */
export type ClaimAttribution = {
  /**
   * Deterministic `issue/<hash>` identity from `computeIssueClaimId`.
   */
  readonly claimId: string;

  /**
   * Critics that emitted it, ordered by model id so identical inputs serialize
   * identically into a cached outcome.
   */
  readonly proposers: readonly ClaimProposer[];
};

/**
 * One critic emitting one resolved claim, before deduplication.
 *
 * @example
 * ```ts
 * const emission: ClaimEmission = { claimId, modelId, };
 * ```
 */
export type ClaimEmission = {
  /**
   * Deterministic identity of the claim emitted.
   */
  readonly claimId: string;

  /**
   * Critic that emitted it.
   */
  readonly modelId: SyntheticModelId;
};

/**
 * Folds raw emissions into per-claim, per-critic counts.
 *
 * Must run BEFORE `aggregateClaims` deduplicates: structurally identical claims
 * collapse to one id there, so afterwards there is no longer anything to
 * attribute a second emitter to.
 *
 * @param emissions - every emission in critic then report order
 *
 * @returns Attribution per claim, claims in first-emission order and proposers
 * sorted by model id
 *
 * @example
 * ```ts
 * const attributions = collectClaimAttributions({ emissions, },);
 * ```
 */
export function collectClaimAttributions(
  {
    emissions,
  }: {
    readonly emissions: readonly ClaimEmission[];
  },
): readonly ClaimAttribution[] {
  /**
   * Per-claim tally of how often each critic emitted it. Mutable while folding
   * and never returned, because a `Map` would not survive `JSON.stringify`
   * into a cached outcome.
   */
  const tally = new Map<string, Map<SyntheticModelId, number>>();

  for (
    const {
      claimId,
      modelId,
    } of emissions
  ) {
    /**
     * Critics seen for this claim so far.
     */
    const byModel = tally.get(claimId,) ?? new Map<SyntheticModelId, number>();
    byModel.set(
      modelId,
      (byModel.get(modelId,) ?? 0) + 1,
    );
    tally.set(
      claimId,
      byModel,
    );
  }

  return [...tally.entries(),].map(function toAttribution(
    [
      claimId,
      byModel,
    ],
  ): ClaimAttribution {
    return {
      claimId,
      proposers: [...byModel.entries(),]
        .map(function toProposer([modelId, emissionCount,],): ClaimProposer {
        return {
          modelId,
          emissionCount,
        };
      },)
        // Code-unit order rather than localeCompare: this value is serialized
        // into a cached outcome and compared across runs, so a comparison that
        // depends on the machine's default locale could order the same
        // proposers differently on two hosts.
        .toSorted(function byModelId(
          left,
          right,
        ): number {
        if (left.modelId < right.modelId)
          return -1;
        if (left.modelId > right.modelId)
          return 1;
        return 0;
      },),
    };
  },);
}

/**
 * Drops attribution for claims that did not survive a later screen.
 *
 * Screening removes claims after attribution is built, and an entry left
 * pointing at a discarded claim would inflate a critic's recorded hits with
 * claims the pipeline threw away.
 *
 * @param attributions - attribution built at emission time
 *
 * @param claimIds - identities still standing
 *
 * @returns Attribution restricted to surviving claims, order preserved
 *
 * @example
 * ```ts
 * const kept = retainAttributions({ attributions, claimIds, },);
 * ```
 */
export function retainAttributions(
  {
    attributions,
    claimIds,
  }: {
    readonly attributions: readonly ClaimAttribution[];
    readonly claimIds: ReadonlySet<string>;
  },
): readonly ClaimAttribution[] {
  return attributions.filter(function survives(attribution,): boolean {
    return claimIds.has(attribution.claimId,);
  },);
}

//endregion Critic attribution
