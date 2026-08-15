import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  type GenerationCensus,
  tipContains,
} from './artifact-generation.ts';
import {
  censusDigests,
  COUNT_WIDTH,
  EmptyPoolError,
  ENTRY_NOUN_WIDTH,
  MixedGenerationError,
  pluralEntries,
} from './artifact-pool-refusal.ts';
import {
  abbreviate,
  type GenerationSelection,
} from './artifact-provenance.ts';

//region Artifact eligibility
// Turns a generation census into the set of entries one draw may pool, and
// REFUSES rather than pooling silently when the answer is ambiguous.
//
// The refusal is the point. The failure this guards against is not a draw that
// knows it spans versions, it is a draw that does not, so the safe default has
// to be the loud one. A caller that genuinely wants every generation says so.
//
// A generation is a BUILT PIPELINE, keyed by the digest of the output that ran.
// Ancestry is still asked of commits, because only commits have ancestry, and it
// is asked per commit rather than per generation: one pipeline can carry several
// commits when a documentation commit moved the tip without changing a byte that
// runs.

/**
 * What a draw may read, and what it must say about what it excluded.
 *
 * @example
 * ```ts
 * const eligible = await selectEligible({ census, requiredCommit, },);
 * ```
 */
export type EligibleEntries = Readonly<{
  /**
   * Entries the draw may pool, sorted.
   */
  entryIds: readonly string[];

  /**
   * Entries excluded because their pipeline predates the required commit.
   */
  excludedIds: readonly string[];

  /**
   * Entries whose artifact would not parse, carried through so the reader that
   * reports malformed artifacts still sees them.
   */
  malformedIds: readonly string[];

  /**
   * Repo commit recorded by each pooled entry, keyed by entry id.
   *
   * Structured rather than left implicit in {@link EligibleEntries.report},
   * because a reader cannot build a truthful record of what it sampled out of
   * prose, and because it lets a reader check the bytes it loaded against the
   * entry the pool admitted. Carries only placed entries: a malformed artifact
   * has no tip and is absent here.
   */
  tipByEntry: ReadonlyMap<string, string>;

  /**
   * Built pipeline recorded by each pooled entry, keyed by entry id.
   *
   * The half of the same check that actually answers "same pipeline". A reader
   * comparing only tips accepts an artifact rewritten by a different build
   * under the same commit, which is the substitution this whole module exists
   * to stop.
   */
  digestByEntry: ReadonlyMap<string, string>;

  /**
   * How these entries were chosen, so a later reader knows what the pool
   * licenses it to claim.
   */
  selection: GenerationSelection;

  /**
   * One line per generation, for printing above any rate this draw produces.
   */
  report: readonly string[];
}>;

/**
 * Built pipeline each placed entry recorded, for the whole census.
 *
 * @param census - what the directory holds
 *
 * @returns Lookup from entry id to recorded digest
 *
 * @example
 * ```ts
 * const digestByEntry = mapDigests({ census, },);
 * ```
 */
function mapDigests(
  { census, }: { readonly census: GenerationCensus; },
): ReadonlyMap<string, string> {
  return new Map(
    census.groups
      .flatMap(function toPairs(group,): readonly (readonly [
        string,
        string,
      ])[] {
        return group.entryIds
          .map(function toPair(entryId,): readonly [
            string,
            string,
          ] {
            return [
              entryId,
              group.digest,
            ];
          },);
      },),
  );
}

/**
 * Renders the lines naming artifacts no generation could hold.
 *
 * Always rendered when there are any, because an excluded artifact that goes
 * unmentioned is exactly a silently smaller denominator.
 *
 * @param census - what the pool actually holds
 *
 * @returns One line per kind of exclusion that occurred, none otherwise
 *
 * @example
 * ```ts
 * const lines = unplaceableLines({ census, },);
 * ```
 */
function unplaceableLines(
  { census, }: { readonly census: GenerationCensus; },
): readonly string[] {
  /**
   * Artifacts that parsed but recorded nothing usable.
   */
  const untagged = census.untaggedIds
    .length;

  /**
   * Artifacts that would not parse, kept for the malformed-artifact reader.
   */
  const malformed = census.malformedIds
    .length;

  /**
   * Artifacts from before a build was recorded, sound but unidentifiable.
   */
  const legacyCount = census.legacyIds
    .length;

  return [
    ...(untagged === 0
      ? []
      : [`POOL   ${String(untagged,)} artifact${
        untagged === 1 ? '' : 's'
      } EXCLUDED, parsed but recording no usable pipeline: ${
        census.untaggedIds
          .join(', ',)
      }`,]),
    ...(legacyCount === 0
      ? []
      : [`POOL   ${String(legacyCount,)} artifact${
        legacyCount === 1 ? '' : 's'
      } EXCLUDED, recording a pipeline this build cannot name: ${
        census.legacyIds
          .join(', ',)
      }`,]),
    ...(malformed === 0
      ? []
      : [`POOL   ${String(malformed,)} artifact${
        malformed === 1 ? '' : 's'
      } unreadable, passed through to be reported as malformed: ${
        census.malformedIds
          .join(', ',)
      }`,]),
  ];
}

/**
 * Whether each recorded commit contains the required one.
 *
 * Asked per distinct COMMIT rather than per generation, because a generation
 * can hold several commits, and per commit rather than per entry, because many
 * entries share one.
 *
 * @param census - what the directory holds
 *
 * @param requiredCommit - commit an entry's pipeline must contain
 *
 * @returns Verdict for every commit the census placed
 *
 * @example
 * ```ts
 * const verdicts = await verdictsByTip({ census, requiredCommit, },);
 * ```
 */
async function verdictsByTip(
  {
    census,
    requiredCommit,
  }: {
    readonly census: GenerationCensus;
    readonly requiredCommit: string;
  },
): Promise<ReadonlyMap<string, boolean>> {
  /**
   * Commits the census placed, each asked about once.
   */
  const tips = [
    ...new Set(census.tipByEntry
      .values(),),
  ].toSorted();

  /**
   * Verdict per commit, filled in order.
   */
  const verdicts = new Map<string, boolean>();

  // Sequential rather than `Promise.all`, which spawned one git process per
  // commit with no bound. Commits are few today, but the count comes from a
  // directory nobody controls, and an unbounded fan-out of processes is the
  // kind of thing that is fine until the day the directory is messy. Ancestry
  // is answered once at startup, so serialising it costs nothing worth
  // measuring.
  /* oxlint-disable no-await-in-loop -- bounding process fan-out is the point */
  for (const tip of tips) {
    verdicts.set(
      tip,
      await tipContains({
        tip,
        commit: requiredCommit,
      },),
    );
  }
  /* oxlint-enable no-await-in-loop */

  return verdicts;
}

/**
 * Selects the entries one draw may pool.
 *
 * @param census - every settled entry, partitioned by built pipeline
 *
 * @param requiredCommit - commit an entry's pipeline must contain, absent when
 * the caller has not chosen one
 *
 * @param pooledDeliberately - whether the caller has explicitly asked to read
 * every generation at once, which is legitimate for a census but never for a
 * rate
 *
 * @returns Eligible entries, what was excluded, and the lines to print above
 * any number drawn from them
 *
 * @throws MixedGenerationError when the pool spans generations and neither a
 * required commit nor deliberate pooling was named
 *
 * @throws EmptyPoolError when filtering leaves nothing to compute a rate over
 *
 * @example
 * ```ts
 * const eligible = await selectEligible({ census, requiredCommit: 'fc7912929', },);
 * ```
 */
export async function selectEligible(
  {
    census,
    requiredCommit,
    pooledDeliberately = false,
  }: {
    readonly census: GenerationCensus;
    readonly requiredCommit?: string;
    readonly pooledDeliberately?: boolean;
  },
): Promise<EligibleEntries> {
  /**
   * Every entry, whatever its generation.
   */
  const everyId = census.groups
    .flatMap(function toIds(group,): readonly string[] {
      return group.entryIds;
    },)
    .toSorted();

  /**
   * How many distinct pipeline versions the pool holds.
   */
  const generationCount = census.groups
    .length;

  /**
   * Built pipeline recorded per entry, the same for every branch below.
   */
  const digestByEntry = mapDigests({ census, },);

  if (requiredCommit === undefined) {
    if ((generationCount > 1) && (!pooledDeliberately))
      throw new MixedGenerationError({ census, },);

    if (everyId.length === 0)
      throw new EmptyPoolError({ census, },);

    /**
     * The one generation present, when exactly one is.
     */
    const [only,] = census.groups;

    return {
      entryIds: everyId,
      excludedIds: [],
      malformedIds: census.malformedIds,
      tipByEntry: census.tipByEntry,
      digestByEntry,
      selection: (generationCount === 1) && (only !== undefined)
        ? {
          kind: 'single-generation',
          digest: only.digest,
        }
        : { kind: 'all-generations', },
      report: [
        `POOL ${String(census.total,)} ${
          pluralEntries({ count: census.total, },)
        } across ${
          String(generationCount,)
        } pipeline generation${generationCount === 1 ? '' : 's'}`,
        ...unplaceableLines({ census, },),
        ...(generationCount > 1
          ? ['POOL pooled DELIBERATELY: this number spans pipeline versions',]
          : []),
      ],
    };
  }

  /**
   * Whether each recorded commit contains the required one.
   */
  const verdicts = await verdictsByTip({
    census,
    requiredCommit,
  },);

  /**
   * Entries whose recorded commit contains the required one.
   */
  const entryIds = everyId
    .filter(function isEligible(entryId,): boolean {
      // Every placed entry carries a commit by construction, since the census
      // places an artifact only after reading one. Asserted rather than
      // defaulted: a missing commit here would mean the census and this filter
      // disagree about what "placed" means, and silently dropping the entry
      // would shrink the denominator without a word.
      return verdicts.get(
        nonNullishOrThrow(census.tipByEntry
          .get(entryId,),),
      ) === true;
    },);

  if (entryIds.length === 0)
    throw new EmptyPoolError({
      census,
      requiredCommit,
    },);

  /**
   * Width at which every id this report prints stays distinguishable,
   * including the required commit, since they appear in one message.
   */
  const short = abbreviate({
    ids: [
      ...censusDigests({ census, },),
      requiredCommit,
    ],
  },);

  /**
   * How many eligible entries each generation contributed, in group order.
   */
  const contributions = census.groups
    .map(function toContribution(group,): number {
      return group.entryIds
        .filter(function survived(entryId,): boolean {
          return entryIds.includes(entryId,);
        },)
        .length;
    },);

  /**
   * Generations that actually contributed entries, which is what the pool
   * spans; a generation excluded by the required commit contributes nothing.
   */
  const pooledCount = contributions
    .filter(function contributed(count,): boolean {
      return count > 0;
    },)
    .length;

  return {
    entryIds,
    malformedIds: census.malformedIds,
    excludedIds: everyId
      .filter(function wasExcluded(entryId,): boolean {
        return !entryIds.includes(entryId,);
      },),
    tipByEntry: census.tipByEntry,
    digestByEntry,
    selection: {
      kind: 'required-commit',
      commit: requiredCommit,
    },
    report: [
      // Says CONTAINING, not "produced by". Ancestry is a compatibility floor:
      // every descendant tip qualifies and descendants may differ from each
      // other arbitrarily, so this pool is a post-baseline cohort rather than
      // one pipeline version. An earlier wording read "requires X: N of M
      // eligible", which invited exactly the reading that a rate over it could
      // be published as X's rate, and did: it was cited that way in a handover
      // note the same evening it was written.
      `POOL commits CONTAINING ${short({ id: requiredCommit, },)}: ${
        String(entryIds.length,)
      } of ${
        String(census.total,)
      } settled entries eligible, spanning ${
        String(pooledCount,)
      } pipeline generation${pooledCount === 1 ? '' : 's'}`,
      ...(pooledCount > 1
        ? [
          'POOL   this is a post-baseline COHORT, not one generation: a rate',
          'POOL   over it belongs to no single pipeline version',
        ]
        : []),
      ...unplaceableLines({ census, },),
      ...census.groups
        .map(function toLine(
          group,
          index,
        ): string {
          /**
           * Entries of this generation that survived the required commit.
           */
          const eligible = contributions[index] ?? 0;

          /**
           * Entries this generation holds in all.
           */
          const size = group.entryIds
            .length;

          return `POOL   ${short({ id: group.digest, },)}  ${
            String(size,)
              .padStart(COUNT_WIDTH,)
          } ${
            pluralEntries({ count: size, },)
              .padEnd(ENTRY_NOUN_WIDTH,)
          }  ${
            eligible === 0
              ? 'stale, excluded'
              : `${String(eligible,)} ELIGIBLE`
          }`;
        },),
    ],
  };
}

//endregion Artifact eligibility
