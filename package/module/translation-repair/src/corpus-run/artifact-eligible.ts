import {
  type GenerationCensus,
  tipContains,
} from './artifact-generation.ts';
import type { GenerationSelection, } from './artifact-provenance.ts';

/**
 * Pipeline commit each placed entry recorded, for the whole census.
 *
 * @param census - what the directory holds
 *
 * @returns Lookup from entry id to recorded commit
 *
 * @example
 * ```ts
 * const tipByEntry = mapTips({ census, },);
 * ```
 */
function mapTips(
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
              group.tip,
            ];
          },);
      },),
  );
}

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
   * Entries whose artifact would not parse, carried through so the reader that
   * reports malformed artifacts still sees them.
   */
  malformedIds: readonly string[];

  /**
   * Pipeline commit recorded by each pooled entry, keyed by entry id.
   *
   * Structured rather than left implicit in {@link EligibleEntries.report},
   * because a reader cannot build a truthful record of what it sampled out of
   * prose, and because it lets a reader check the bytes it loaded against the
   * entry the pool admitted. Carries only placed entries: a malformed artifact
   * has no tip and is absent here.
   */
  tipByEntry: ReadonlyMap<string, string>;

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
 * Width of the longest noun {@link pluralEntries} returns, so a count and its
 * noun keep a fixed column in a report listing several generations.
 */
const ENTRY_NOUN_WIDTH = 'entries'.length;

/**
 * Names a count of entries with the matching noun.
 *
 * @param count - how many entries
 *
 * @returns Singular noun at one, plural otherwise
 *
 * @example
 * ```ts
 * const noun = pluralEntries({ count: 1, },);
 * ```
 */
function pluralEntries({ count, }: { readonly count: number; },): string {
  return count === 1 ? 'entry' : 'entries';
}

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
            } ${
              pluralEntries({
                count: group.entryIds
                  .length,
              },)
            }`;
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
 * Raised when generation filtering leaves no entry to pool at all.
 */
export class EmptyPoolError extends Error {
  /**
   * Names why the pool came out empty and what would refill it.
   *
   * @param census - what the directory actually holds
   *
   * @param requiredCommit - commit that was required, absent when none was
   *
   * @example
   * ```ts
   * throw new EmptyPoolError({ census, requiredCommit, },);
   * ```
   */
  constructor(
    {
      census,
      requiredCommit,
    }: {
      readonly census: GenerationCensus;
      readonly requiredCommit?: string;
    },
  ) {
    super(
      [
        ...(census.total === 0
          ? ['No entry has settled yet, so there is nothing to pool.',]
          : [
            `All ${
              String(census.total,)
            } settled entries were excluded by generation filtering.`,
            ...(requiredCommit === undefined ? [] : [
              `None of them records a pipeline containing ${
                requiredCommit.slice(
                  0,
                  SHORT_SHA,
                )
              }:`,
            ]),
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
                } ${
                  pluralEntries({
                    count: group.entryIds
                      .length,
                  },)
                }`;
              },),
          ]),
        '',
        'This THROWS rather than returning an empty pool, because every caller',
        'of this function goes on to compute a rate. A rate over zero entries',
        'is this module\'s own failure mode taken to its limit: a denominator',
        'quietly shrunk, here all the way to nothing, while the number above it',
        'still renders. Accumulate entries under the required pipeline, or',
        'require an earlier commit that the settled entries actually contain.',
      ].join('\n',),
    );
    this.name = 'EmptyPoolError';
  }
}

/**
 * Renders the line naming artifacts no generation could hold.
 *
 * Always rendered when there are any, because an excluded artifact that goes
 * unmentioned is exactly a silently smaller denominator.
 *
 * @param census - what the pool actually holds
 *
 * @returns One line when entries were unplaceable, none otherwise
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
   * Artifacts that parsed but recorded no commit, so no generation holds them.
   */
  const untagged = census.untaggedIds
    .length;

  /**
   * Artifacts that would not parse, kept for the malformed-artifact reader.
   */
  const malformed = census.malformedIds
    .length;

  return [
    ...(untagged === 0
      ? []
      : [`POOL   ${String(untagged,)} artifact${
        untagged === 1 ? '' : 's'
      } EXCLUDED, parsed but recording no pipeline commit: ${
        census.untaggedIds
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

    if (everyId.length === 0)
      throw new EmptyPoolError({ census, },);

    return {
      entryIds: everyId,
      excludedIds: [],
      malformedIds: census.malformedIds,
      tipByEntry: mapTips({ census, },),
      selection: (generationCount === 1) && (census.groups[0] !== undefined)
        ? {
          kind: 'single-tip',
          tip: census.groups[0]
            .tip,
        }
        : { kind: 'all-tips', },
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
   * Whether each generation contains the required commit, resolved once per
   * generation rather than once per entry.
   */
  // Sequential rather than `Promise.all`, which spawned one git process per
  // generation with no bound. Generations are few today, but the count comes
  // from a directory nobody controls, and an unbounded fan-out of processes is
  // the kind of thing that is fine until the day the directory is messy.
  // Ancestry is answered once per generation at startup, so serialising it
  // costs nothing worth measuring.
  const verdicts: GenerationVerdict[] = [];
  /* oxlint-disable no-await-in-loop -- bounding process fan-out is the point */
  for (const group of census.groups) {
    verdicts.push({
      group,
      contains: await tipContains({
        tip: group.tip,
        commit: requiredCommit,
      },),
    },);
  }
  /* oxlint-enable no-await-in-loop */

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

  if (entryIds.length === 0)
    throw new EmptyPoolError({
      census,
      requiredCommit,
    },);

  /**
   * Generations that actually contributed entries, which is what the pool
   * spans; a generation excluded by the required commit contributes nothing.
   */
  const pooledTips = verdicts
    .filter(function isEligible(verdict,): boolean {
      return verdict.contains;
    },)
    .map(function toTip(verdict,): string {
      return verdict.group
        .tip;
    },);

  return {
    entryIds,
    malformedIds: census.malformedIds,
    excludedIds: everyId
      .filter(function wasExcluded(entryId,): boolean {
        return !entryIds.includes(entryId,);
      },),
    tipByEntry: mapTips({ census, },),
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
      `POOL commits CONTAINING ${requiredCommit.slice(
        0,
        SHORT_SHA,
      )}: ${String(entryIds.length,)} of ${
        String(census.total,)
      } settled entries eligible, spanning ${
        String(pooledTips.length,)
      } pipeline generation${pooledTips.length === 1 ? '' : 's'}`,
      ...(pooledTips.length > 1
        ? [
          'POOL   this is a post-baseline COHORT, not one generation: a rate',
          'POOL   over it belongs to no single pipeline version',
        ]
        : []),
      ...unplaceableLines({ census, },),
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
          } ${
            pluralEntries({
              count: group.entryIds
                .length,
            },)
              .padEnd(ENTRY_NOUN_WIDTH,)
          }  ${verdict.contains ? 'ELIGIBLE' : 'stale, excluded'}`;
        },),
    ],
  };
}

//endregion Artifact eligibility
