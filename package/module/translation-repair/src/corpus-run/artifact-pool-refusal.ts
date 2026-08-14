import type { GenerationCensus, } from './artifact-generation.ts';
import { abbreviate, } from './artifact-provenance.ts';

//region Artifact pool refusal
// The two LOUD outcomes of generation filtering, and the vocabulary their
// reports share with the ordinary one.
//
// Split from `artifact-eligible.ts` when generation identity moved to the built
// digest and that file reached its line budget. The split is not arbitrary:
// selecting entries is one job, and explaining a refusal in enough detail that
// someone can act on it is another, which is why these messages run to
// paragraphs while the selection reads as a few filters.

/**
 * Column width for an entry count, so generations line up under each other.
 */
export const COUNT_WIDTH = 3;

/**
 * Width of the longest noun {@link pluralEntries} returns, so a count and its
 * noun keep a fixed column in a report listing several generations.
 */
export const ENTRY_NOUN_WIDTH: number = 'entries'.length;

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
export function pluralEntries(
  { count, }: { readonly count: number; },
): string {
  return count === 1 ? 'entry' : 'entries';
}

/**
 * Every built pipeline a census holds, for sizing an abbreviation that cannot
 * collide.
 *
 * @param census - what the directory holds
 *
 * @returns Digests in group order
 *
 * @example
 * ```ts
 * const short = abbreviate({ ids: censusDigests({ census, },), },);
 * ```
 */
export function censusDigests(
  { census, }: { readonly census: GenerationCensus; },
): readonly string[] {
  return census.groups
    .map(function toDigest(group,): string {
      return group.digest;
    },);
}

/**
 * Renders one line per generation: its pipeline and how many entries it holds.
 *
 * @param census - what the directory holds
 *
 * @param short - abbreviator sized over everything this report prints
 *
 * @returns One line per generation, largest first
 *
 * @example
 * ```ts
 * const lines = generationLines({ census, short, },);
 * ```
 */
export function generationLines(
  {
    census,
    short,
  }: {
    readonly census: GenerationCensus;
    readonly short: (input: { readonly id: string; }) => string;
  },
): readonly string[] {
  return census.groups
    .map(function toLine(group,): string {
      /**
       * Entries this generation holds.
       */
      const size = group.entryIds
        .length;

      return `  ${short({ id: group.digest, },)}  ${String(size,)} ${
        pluralEntries({ count: size, },)
      }`;
    },);
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
     * Width at which these pipelines stay distinguishable.
     */
    const short = abbreviate({ ids: censusDigests({ census, },), },);

    /**
     * How many distinct pipeline versions the directory holds.
     */
    const generationCount = census.groups
      .length;

    super(
      [
        `This artifacts directory holds ${
          String(census.total,)
        } settled entries across ${
          String(generationCount,)
        } pipeline generations:`,
        ...generationLines({
          census,
          short,
        },),
        '',
        'Each line names the BUILT OUTPUT those entries ran, not a commit. Two',
        'generations here mean two different pipelines wrote into one directory,',
        'whatever their commits say.',
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
    /**
     * Width at which everything this report prints stays distinguishable,
     * including the required commit, which is not a digest but shares the page.
     */
    const short = abbreviate({
      ids: [
        ...censusDigests({ census, },),
        ...(requiredCommit === undefined ? [] : [requiredCommit,]),
      ],
    },);

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
                short({ id: requiredCommit, },)
              }:`,
            ]),
            ...generationLines({
              census,
              short,
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

//endregion Artifact pool refusal
