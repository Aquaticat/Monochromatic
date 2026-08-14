import {
  type GenerationCensus,
  tipContains,
} from './artifact-generation.ts';

//region Artifact eligibility
// Turns a generation census into the set of entries one draw may pool, and
// REFUSES rather than pooling silently when the answer is ambiguous.
//
// The refusal is the point. The failure this guards against is not a draw that
// knows it spans versions, it is a draw that does not, so the safe default has
// to be the loud one. A caller that genuinely wants every generation says so.

/**
 * Characters of a commit shown in a report.
 *
 * Nine rather than seven: this repository already has commits that collide at
 * seven, and a report whose two lines read alike is a report nobody can act on.
 */
const SHORT_SHA = 9;

/**
 * Column width for an entry count, so generations line up under each other.
 */
const COUNT_WIDTH = 3;

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
   * One line per generation, for printing above any rate this draw produces.
   */
  report: readonly string[];
}>;

/**
 * One generation paired with whether it contains the required commit.
 *
 * Named rather than inferred, because an inferred object literal carries
 * writable properties and every later callback reading this list then takes a
 * mutable parameter it never mutates.
 */
type GenerationVerdict = Readonly<{
  /**
   * Generation being placed.
   */
  group: GenerationCensus['groups'][number];

  /**
   * Whether its pipeline contains the required commit.
   */
  contains: boolean;
}>;

/**
 * Raised when a pool spans pipeline generations and the caller named none.
 */
export class MixedGenerationError extends Error {
  /**
   * Names every generation present and how to proceed.
   *
   * @param census - what the pool actually holds
   *
   * @example
   * ```ts
   * throw new MixedGenerationError({ census, },);
   * ```
   */
  constructor({ census, }: { readonly census: GenerationCensus; },) {
    /**
     * How many distinct pipeline versions the directory holds.
     */
    const generationCount = census.groups
      .length;

    super(
      [
        `This artifacts directory holds ${String(census.total,)} settled entries across ${
          String(generationCount,)
        } pipeline generations:`,
        ...census.groups
          .map(function toLine(group,): string {
            return `  ${
              group.tip
                .slice(
                  0,
                  SHORT_SHA,
                )
            }  ${
              String(group.entryIds
                .length,)
            } entries`;
          },),
        '',
        'Pooling them would mix pipeline versions into one rate, and that rate',
        'would describe no pipeline that ever existed. Name the commit a draw',
        'requires, and entries whose recorded tip does not contain it are',
        'excluded and reported. To pool every generation deliberately, ask for',
        'it explicitly.',
      ].join('\n',),
    );
    this.name = 'MixedGenerationError';
  }
}

/**
 * Selects the entries one draw may pool.
 *
 * @param census - every settled entry, partitioned by pipeline commit
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

  if (requiredCommit === undefined) {
    if ((generationCount > 1) && (!pooledDeliberately))
      throw new MixedGenerationError({ census, },);

    return {
      entryIds: everyId,
      excludedIds: [],
      report: [
        `POOL ${String(census.total,)} entries across ${
          String(generationCount,)
        } pipeline generation${generationCount === 1 ? '' : 's'}`,
        ...(generationCount > 1
          ? ['POOL pooled DELIBERATELY: this number spans pipeline versions',]
          : []),
      ],
    };
  }

  /**
   * Whether each generation contains the required commit, resolved once per
   * generation rather than once per entry.
   */
  const verdicts = await Promise.all(
    census.groups
      .map(async function toVerdict(group,): Promise<GenerationVerdict> {
        return {
          group,
          contains: await tipContains({
            tip: group.tip,
            commit: requiredCommit,
          },),
        };
      },),
  );

  /**
   * Entries whose pipeline contains the required commit.
   */
  const entryIds = verdicts
    .filter(function isEligible(verdict,): boolean {
      return verdict.contains;
    },)
    .flatMap(function toIds(verdict,): readonly string[] {
      return verdict.group
        .entryIds;
    },)
    .toSorted();

  return {
    entryIds,
    excludedIds: everyId
      .filter(function wasExcluded(entryId,): boolean {
        return !entryIds.includes(entryId,);
      },),
    report: [
      `POOL requires ${requiredCommit.slice(
        0,
        SHORT_SHA,
      )}: ${String(entryIds.length,)} of ${
        String(census.total,)
      } settled entries eligible`,
      ...verdicts
        .map(function toLine(verdict,): string {
          /**
           * Generation this line describes.
           */
          const { group, } = verdict;

          return `POOL   ${
            group.tip
              .slice(
                0,
                SHORT_SHA,
              )
          }  ${
            String(group.entryIds
              .length,)
              .padStart(COUNT_WIDTH,)
          } entries  ${verdict.contains ? 'ELIGIBLE' : 'stale, excluded'}`;
        },),
    ],
  };
}

//endregion Artifact eligibility
