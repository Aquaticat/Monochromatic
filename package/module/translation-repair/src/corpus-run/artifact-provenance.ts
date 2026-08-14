//region Artifact provenance
// What a reader must prove about the BYTES IT ACTUALLY READ before a number
// drawn from them may name a pipeline.
//
// The generation filter answers "which entries may be pooled" from a census.
// That census is a SEPARATE directory read from the one each reader performs
// afterwards, and the accumulation writes new artifacts continuously, so the
// metadata the census returned is not automatically metadata for the bytes a
// reader later loaded. A file can arrive between the two reads, and a file can
// change between being classified and being loaded.
//
// Nothing here re-reads or re-derives. It compares what the census said against
// what the reader observed, and refuses when they disagree, which is the only
// way that gap surfaces at all: every other outcome of it looks like ordinary
// output.

/**
 * Fewest characters of a commit ever shown, so short reports stay scannable.
 *
 * Nine rather than seven because this repository already has commits colliding
 * at seven. It is a FLOOR, not the answer: see {@link abbreviate}.
 */
const MIN_ABBREVIATION = 9;

/**
 * Shortens commits just enough that the ones being shown stay distinguishable.
 *
 * A fixed width is a bet that no two commits in a report share a prefix, and
 * the bet has already been lost once here at seven characters. Widening to
 * nine only moved the bet. Two generations rendering as the same string is
 * worse than a long string: a report whose two lines read alike is a report
 * nobody can act on, and this one is read precisely when a pool is suspected of
 * spanning versions.
 *
 * Grows from {@link MIN_ABBREVIATION} until every input is unique, so an
 * ordinary report is short and only an actual collision pays for length.
 *
 * @param tips - every commit that will appear in this report
 *
 * @returns Function shortening one commit to the agreed width
 *
 * @example
 * ```ts
 * const short = abbreviate({ tips: census.groups.map(toTip), },);
 * console.log(short({ tip, },),);
 * ```
 */
export function abbreviate(
  { tips, }: { readonly tips: readonly string[]; },
): (input: { readonly tip: string; }) => string {
  /**
   * Longest commit shown, the point past which growing cannot help.
   */
  const longest = tips.reduce(
    function toLongest(
      soFar,
      tip,
    ): number {
      return Math.max(
        soFar,
        tip.length,
      );
    },
    MIN_ABBREVIATION,
  );

  /**
   * Every width worth testing, shortest first.
   */
  const candidates = Array.from(
    { length: (longest - MIN_ABBREVIATION) + 1, },
    function toWidth(
      _unused,
      offset,
    ): number {
      return MIN_ABBREVIATION + offset;
    },
  );

  /**
   * Shortest width at which no two of these commits read alike.
   *
   * Full length when even that cannot separate them, which means the same
   * commit was passed twice and no width would have helped.
   */
  const width = candidates.find(function separates(candidate,): boolean {
    return new Set(tips.map(function toPrefix(tip,): string {
      return tip.slice(
        0,
        candidate,
      );
    },),).size === new Set(tips,).size;
  },) ?? longest;
  return function short({ tip, }: { readonly tip: string; },): string {
    return tip.slice(
      0,
      width,
    );
  };
}

/**
 * How a reader chose which pipeline generations it would pool.
 *
 * Recorded rather than inferred from the required commit alone, because the
 * three modes are not distinguishable after the fact and they license different
 * claims. Only `single-tip` licenses "produced by pipeline X".
 *
 * @example
 * ```ts
 * const selection: GenerationSelection = { kind: 'single-tip', tip, };
 * ```
 */
export type GenerationSelection =
  | Readonly<{
    /**
     * Entries whose recorded pipeline CONTAINS a named commit.
     *
     * This is an ancestry floor, not a generation. Every descendant tip
     * qualifies, and descendants may differ from each other arbitrarily, so a
     * pool selected this way is a post-baseline cohort rather than one version.
     */
    kind: 'required-commit';

    /**
     * Commit an entry's pipeline must contain.
     */
    commit: string;
  }>
  | Readonly<{
    /**
     * Entries recording exactly one pipeline commit, the only selection that
     * licenses describing a rate as belonging to that pipeline.
     */
    kind: 'single-tip';

    /**
     * Commit every pooled entry recorded.
     */
    tip: string;
  }>
  | Readonly<{
    /**
     * Every generation present, pooled deliberately. Legitimate for a census,
     * never for a rate.
     */
    kind: 'all-tips';
  }>;

/**
 * Raised when loaded bytes disagree with what the pool said about them.
 */
export class ArtifactProvenanceError extends Error {
  /**
   * Names the artifact, the disagreement, and why it is fatal rather than
   * skippable.
   *
   * @param name - artifact file name as read from disk
   *
   * @param field - what disagreed
   *
   * @param expected - value the pool recorded
   *
   * @param observed - value the loaded bytes carry
   *
   * @example
   * ```ts
   * throw new ArtifactProvenanceError({ name, field: 'tip', expected, observed, },);
   * ```
   */
  constructor(
    {
      name,
      field,
      expected,
      observed,
    }: {
      readonly name: string;
      readonly field: string;
      readonly expected: string;
      readonly observed: string;
    },
  ) {
    super(
      [
        `Artifact ${name} disagrees with the pool about its ${field}.`,
        `  pool recorded  ${expected}`,
        `  bytes carry    ${observed}`,
        '',
        'The pool is built from one directory read and each artifact is loaded',
        'by a later one, while the accumulation keeps writing. A disagreement',
        'means the entry admitted to the pool is not the entry that was read,',
        'so every number drawn from it describes something other than what was',
        'filtered. Re-run the reader against a directory nothing is writing to.',
      ].join('\n',),
    );
    this.name = 'ArtifactProvenanceError';
  }
}

/**
 * Refuses a loaded artifact that is not the one the pool admitted.
 *
 * Called by READERS rather than by the census, deliberately. The census now
 * runs inside `assertResumableGeneration` at pass startup, and a throw there
 * would abort an accumulation over a telemetry invariant; a throw here costs
 * only the report.
 *
 * @param name - artifact file name, whose stem is the id the pool keyed on
 *
 * @param observedId - entry id the loaded bytes record
 *
 * @param observedTip - pipeline commit the loaded bytes record
 *
 * @param expectedTip - pipeline commit the pool recorded for this entry, absent
 * when the pool carried no tip for it
 *
 * @throws ArtifactProvenanceError when the file name, the recorded id, or the
 * recorded tip disagree
 *
 * @example
 * ```ts
 * assertArtifactProvenance({ name, observedId, observedTip, expectedTip, },);
 * ```
 */
export function assertArtifactProvenance(
  {
    name,
    observedId,
    observedTip,
    expectedTip,
  }: {
    readonly name: string;
    readonly observedId: string;
    readonly observedTip: string;
    readonly expectedTip?: string;
  },
): void {
  /**
   * Entry id the pool keyed on, which is the artifact's own file name.
   */
  const keyedId = name.endsWith('.json',)
    ? name.slice(
      0,
      -'.json'.length,
    )
    : name;

  if (observedId !== keyedId)
    throw new ArtifactProvenanceError({
      name,
      field: 'entry id',
      expected: keyedId,
      observed: observedId,
    },);

  // Absent rather than empty means the pool never placed this entry, which is
  // how a malformed artifact reaches its reporting reader. That is a state the
  // pool defines, not a disagreement.
  if (expectedTip === undefined)
    return;

  if (observedTip !== expectedTip)
    throw new ArtifactProvenanceError({
      name,
      field: 'tip',
      expected: expectedTip,
      observed: observedTip,
    },);
}

//endregion Artifact provenance
