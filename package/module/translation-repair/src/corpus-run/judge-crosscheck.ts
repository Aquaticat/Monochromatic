import type { SyntheticModelId, } from '../synthetic-catalog.ts';
import type { AttributionEntry, } from './attribution-report.ts';
import { seatJudges, } from './judge-independence.ts';

//region Judge crosscheck census
// Which claims a disinterested judge may re-examine, and what the reading is
// allowed to conclude from the answer.
//
// A CENSUS, NOT A SAMPLE. Every attributed claim in every attributed entry is
// enumerated, because the eligible population is small enough to judge whole
// and a sampler would add a seed, a bias question and a reproducibility burden
// for nothing. If the population outgrows the budget, cap it here and say so;
// do not quietly sample.
//
// TWO ARMS, and the control is the point. Judging only accepted claims yields
// an agreement rate with nothing to compare against: a roster that says
// `supported` to everything scores identically to one that reads carefully.
// The control arm re-asks the same judges about claims the panel did NOT
// accept. A crosscheck worth citing agrees with the panel more on the accepted
// arm than on the control arm, and the gap between the two is the finding.
// Equal rates mean the judges are not discriminating and the accepted-arm
// number means nothing on its own.

/**
 * Which side of the crosscheck a claim sits on.
 *
 * `undecided` is separated from `control` rather than folded into it, and the
 * distinction is the difference between a rate and an average over two
 * incommensurable things. `rejected` means the panel DECIDED AGAINST the
 * claim, so there is a verdict for a judge to agree or disagree with.
 * `needs-human` means the panel DECLINED TO DECIDE, so agreement is undefined:
 * there is no verdict to survive re-asking. Measured on this run those claims
 * lean supported 228 to 23, so filing them as control would fill the control
 * arm with claims the panel mostly believed.
 *
 * `source-defect` sits in `control` because it IS a verdict, the panel ruling
 * the original text wrong at the claimed spot rather than the translation.
 */
export type CrosscheckArm = 'accepted' | 'control' | 'undecided';

/**
 * One claim queued for re-examination, with its seating already worked out.
 *
 * @example
 * ```ts
 * const item: CrosscheckItem = { entryId: 'Whiskers', claimId, arm: 'accepted', status: 'accepted', proposers, judges, barred, };
 * ```
 */
export type CrosscheckItem = {
  /**
   * Corpus entry this claim came from.
   */
  readonly entryId: string;

  /**
   * Deterministic claim identity, the join key between attribution and issues.
   */
  readonly claimId: string;

  /**
   * Which arm this claim serves.
   */
  readonly arm: CrosscheckArm;

  /**
   * Adjudication status verbatim, kept beside {@link CrosscheckItem.arm} so a
   * control-arm result can be broken down by reason without re-reading
   * artifacts.
   */
  readonly status: string;

  /**
   * Models that proposed this claim and therefore may not judge it.
   */
  readonly proposers: readonly string[];

  /**
   * Models seated to judge it.
   */
  readonly judges: readonly SyntheticModelId[];

  /**
   * Models barred as authors.
   */
  readonly barred: readonly SyntheticModelId[];
};

/**
 * The enumerated population, with everything excluded from it counted.
 *
 * @example
 * ```ts
 * const census = buildCrosscheckCensus({ entries, roster, },);
 * ```
 */
export type CrosscheckCensus = {
  /**
   * Claims a disinterested judge may rule on, in entry then claim order.
   */
  readonly items: readonly CrosscheckItem[];

  /**
   * Claims every roster model proposed, so nobody may judge them.
   *
   * Carried out rather than dropped. A claim the whole roster authored is the
   * most corroborated claim in the run, and silently removing it would lift
   * every rate by hiding the strongest agreement in the population.
   */
  readonly unjudgeable: readonly CrosscheckItem[];

  /**
   * Claims on entries that predate attribution entirely.
   *
   * Expected, not a defect. An entry settled before attribution was recorded
   * names claims no proposer was ever written for. Counted so a reading can
   * see how much of the run the census covers.
   */
  readonly unattributedLegacyClaims: number;

  /**
   * Claims on entries that DO carry attribution, yet whose id no attribution
   * record holds.
   *
   * A DEFECT IN THE JOIN, and held apart from the legacy count for that
   * reason. On an entry whose critics were attributed, every surviving claim
   * should have a proposer; one that does not means the two records disagree
   * about claim identity, and folding it in with the legacy claims would hide
   * a broken join inside an expected number.
   */
  readonly unattributedJoinFailures: number;

  /**
   * Entries carrying no attribution at all, settled before it was recorded.
   */
  readonly entriesWithoutAttribution: number;

  /**
   * Entries the census draws from.
   */
  readonly entriesCovered: number;
};

/**
 * Adjudication statuses that carry a verdict a judge can be asked to confirm.
 *
 * A `Record` rather than a chain, so adding a status is a data edit and an
 * UNKNOWN status is visibly absent rather than silently swept into a default.
 */
const ARM_OF_STATUS: Readonly<Record<string, CrosscheckArm>> = {
  'accepted': 'accepted',
  'rejected': 'control',
  'source-defect': 'control',
  'needs-human': 'undecided',
} as const;

/**
 * Places one claim in an arm by the verdict its issue carries.
 *
 * An unrecognized status lands in `undecided` rather than `control`, which is
 * the conservative direction: a status this code has never seen is one whose
 * meaning it cannot assert, and `undecided` is reported apart from every rate
 * instead of quietly becoming a denominator.
 *
 * @param status - adjudication status verbatim from the artifact
 *
 * @returns Arm the claim belongs to
 *
 * @example
 * ```ts
 * const arm = armOf({ status: 'rejected', },);
 * ```
 */
function armOf({ status, }: { readonly status: string; },): CrosscheckArm {
  return ARM_OF_STATUS[status] ?? 'undecided';
}

/**
 * Enumerates every claim a disinterested judge may re-examine, both arms.
 *
 * @param entries - settled entries as the attribution reader returns them
 *
 * @param roster - models available to judge
 *
 * @returns Census with both arms populated and every exclusion counted
 *
 * @example
 * ```ts
 * const { items, unjudgeable, } = buildCrosscheckCensus({ entries, roster: RUN_ROSTER, },);
 * ```
 */
export function buildCrosscheckCensus(
  {
    entries,
    roster,
  }: {
    readonly entries: readonly AttributionEntry[];
    readonly roster: readonly SyntheticModelId[];
  },
): CrosscheckCensus {
  /**
   * Every claim of every entry, paired with its seating.
   */
  const enumerated = entries.flatMap(function toItems(entry,): readonly CrosscheckItem[] {
    /**
     * Proposers of each attributed claim in this entry.
     */
    const proposersOf = new Map<string, readonly string[]>();
    for (const chunk of entry.chunkCritics ?? []) {
      for (const attribution of chunk.claimAttributions) {
        proposersOf.set(
          attribution.claimId,
          attribution.proposers
            .map(function toId(proposer,): string {
              return proposer.modelId;
            },),
        );
      }
    }

    return entry.issues.flatMap(function toClaims(issue,): readonly CrosscheckItem[] {
      return issue.claimIds
        .filter(function isAttributed(claimId,): boolean {
          return proposersOf.has(claimId,);
        },)
        .map(function toItem(claimId,): CrosscheckItem {
          /**
           * Authors of this claim, known present by the filter above.
           */
          const proposers = proposersOf.get(claimId,) ?? [];

          /**
           * Who may re-examine this claim and who authored it.
           */
          const {
            judges,
            barred,
          } = seatJudges({
            proposers,
            roster,
          },);

          return {
            entryId: entry.id,
            claimId,
            arm: armOf({ status: issue.status, },),
            status: issue.status,
            proposers,
            judges,
            barred,
          };
        },);
    },);
  },);

  /**
   * Claims an issue names that no attribution record covers, split by whether
   * the entry carries attribution at all.
   */
  const unattributed = entries.reduce(
    function countMissing(
      total: {
        readonly legacy: number;
        readonly joinFailures: number;
      },
      entry,
    ) {
      /**
       * Claim ids this entry attributed.
       */
      const attributed = new Set(
        (entry.chunkCritics ?? []).flatMap(function toIds(chunk,): readonly string[] {
          return chunk.claimAttributions
            .map(function toId(attribution,): string {
              return attribution.claimId;
            },);
        },),
      );

      /**
       * Claims of this entry with no proposer recorded.
       */
      const missing = entry.issues.reduce(
        function countEntryMissing(running: number, issue,): number {
          return running + issue.claimIds
            .filter(function isMissing(claimId,): boolean {
              return !attributed.has(claimId,);
            },).length;
        },
        0,
      );

      // An entry attributing nothing is legacy; one attributing something and
      // still missing a claim has a join that disagrees with itself.
      return (attributed.size === 0)
        ? {
          legacy: total.legacy + missing,
          joinFailures: total.joinFailures,
        }
        : {
          legacy: total.legacy,
          joinFailures: total.joinFailures + missing,
        };
    },
    {
      legacy: 0,
      joinFailures: 0,
    },
  );

  return {
    items: enumerated.filter(function isJudgeable(item,): boolean {
      return item.judges.length > 0;
    },),
    unjudgeable: enumerated.filter(function isUnjudgeable(item,): boolean {
      return item.judges.length === 0;
    },),
    unattributedLegacyClaims: unattributed.legacy,
    unattributedJoinFailures: unattributed.joinFailures,
    entriesWithoutAttribution: entries.filter(function isBare(entry,): boolean {
      return (entry.chunkCritics ?? []).every(function empty(chunk,): boolean {
        return chunk.claimAttributions.length === 0;
      },);
    },).length,
    entriesCovered: entries.length,
  };
}

//endregion Judge crosscheck census
