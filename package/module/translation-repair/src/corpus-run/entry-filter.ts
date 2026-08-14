//region Entry filter
// Restricts a pass to named corpus entries.
//
// WHY THIS EXISTS. The pass orders entries so coverage fills evenly, which is
// right for accumulation and wrong when one specific entry is the evidence for
// an open question. `Toka_ls`, the entry whose editor fabricated three lines,
// sat at position 22 of 71: roughly fourteen hours away at the measured
// per-entry cost, for a question a single entry answers.
//
// RUN IT INTO A THROWAWAY RUNS DIRECTORY. Hand-picking an entry into the main
// pass would put a deliberately chosen document into a pool that later draws
// treat as a natural accumulation, which is exactly the bias a seeded stratified
// draw exists to avoid. Point `TRANSLATION_REPAIR_RUNS_DIR` somewhere disposable
// and the accumulation stays honest.

/**
 * Separator between ids in the flag value.
 */
const ID_SEPARATOR = ',';

/**
 * Flag introducing the id list.
 */
const ONLY_FLAG = '--only';

/**
 * Reads the entry allowlist from command-line arguments.
 *
 * An EMPTY SET MEANS EVERY ENTRY, which keeps the ordinary pass untouched: the
 * flag is absent, the set is empty, and no filtering happens. That is why this
 * returns a set rather than an optional list; a caller cannot forget to handle
 * absence, because absence and "no restriction" are the same value.
 *
 * @param argv - process arguments, including the runtime and script paths
 *
 * @returns Ids to run, empty when unrestricted
 *
 * @example
 * ```ts
 * const onlyIds = readOnlyIds({ argv: process.argv, },);
 * ```
 */
export function readOnlyIds(
  { argv, }: { readonly argv: readonly string[]; },
): ReadonlySet<string> {
  /**
   * Position of the flag, or -1 when it is absent.
   */
  const flagIndex = argv.indexOf(ONLY_FLAG,);
  if (flagIndex === (-1))
    return new Set();

  /**
   * Value following the flag, absent when the flag ends the arguments.
   */
  const value = argv[flagIndex + 1];
  if ((value === undefined) || value.startsWith('--',)) {
    throw new Error(
      `${ONLY_FLAG} needs a comma-separated entry id list, for example `
        + `${ONLY_FLAG} Toka_ls`,
    );
  }

  /**
   * Requested ids with surrounding whitespace and empty members removed.
   */
  const ids = value
    .split(ID_SEPARATOR,)
    .map(function trim(id,): string {
      return id.trim();
    },)
    .filter(function isPresent(id,): boolean {
      return id !== '';
    },);

  // A flag that parsed to nothing would silently run the WHOLE corpus, which is
  // the opposite of what was asked and expensive to discover afterwards.
  if (ids.length === 0)
    throw new Error(`${ONLY_FLAG} matched no entry id in ${JSON.stringify(value,)}`,);

  return new Set(ids,);
}

//endregion Entry filter
