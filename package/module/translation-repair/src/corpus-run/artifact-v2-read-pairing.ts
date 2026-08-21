import { requireExactKeys, } from '../artifact-exact-guard.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
} from '../artifact-guard.ts';
import type { ArtifactSectionPairingV2, } from './artifact-v2-contract.ts';

//region Artifact version 2 pairing read
// Reading the pairing a settled preparation was built on.
//
// ITS OWN FILE rather than another branch of `artifact-v2-read.ts`, which holds
// the whole-artifact and whole-preparation shapes and has no room left under
// the file-length limit. The reader is already sharded this way, one subject
// per sibling, and this is a subject: an absence with two meanings, a bounded
// index, and an order that carries meaning.
//
// EVERY REFUSAL HERE MIRRORS AN INVARIANT THE PRODUCER ALREADY HOLDS, which is
// the only kind worth enforcing on a stored record. `readBlockPairing` refuses
// a reply that moves backwards on either side or repeats a correspondence, and
// the agreement filter is a subset of one such reply, so a stored pairing that
// breaks either was not written by this pipeline. Refusing a shape the producer
// CAN emit would reject valid artifacts, which is worse than checking nothing.

/**
 * What an artifact says about the pairing its slicing was built on.
 *
 * A UNION RATHER THAN AN OPTIONAL LIST, for the same reason the schema reading
 * in `artifact-schema-version.ts` is one: the empty list is a real answer here.
 * The roster can be asked about every section and commit to nothing, and a
 * consumer writing `pairing ?? []` would turn "nobody was asked" into "asked
 * and agreed nothing", which is a claim about the run.
 *
 * @example
 * ```ts
 * const pairing: ParsedBlockPairingV2 = { kind: 'unrecorded', };
 * ```
 */
export type ParsedBlockPairingV2 = {
  /**
   * Artifact records a pairing, which may name no sections at all.
   */
  readonly kind: 'stored';

  /**
   * Sections a pairing was consumed for, in section order.
   */
  readonly sections: readonly ArtifactSectionPairingV2[];
} | {
  /**
   * Artifact names no pairing, which for every artifact settled to date means
   * it was written before the field existed.
   */
  readonly kind: 'unrecorded';
};

/**
 * Reads one section's agreed correspondences.
 *
 * @param value - pairs as the section carries them
 *
 * @param path - dotted path for error messages
 *
 * @returns Pairs this section names, in the order recorded
 *
 * @throws {@link ArtifactParseError} when a pair is the wrong shape or carries
 * a key this version does not name
 *
 * @example
 * ```ts
 * const pairs = parseSectionPairs({ value: record.pairs, path, },);
 * ```
 */
function parseSectionPairs(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactSectionPairingV2['pairs'] {
  return requireArray({
    value,
    path,
  },)
    .map(function readPair(
      entry,
      at,
    ): ArtifactSectionPairingV2['pairs'][number] {
      /**
       * Where this pair is reported from.
       */
      const entryPath = `${path}[${String(at,)}]`;

      /**
       * Pair as a record.
       */
      const record = requireRecord({
        value: entry,
        path: entryPath,
      },);
      requireExactKeys({
        record,
        allowed: [
          'source',
          'target',
        ],
        path: entryPath,
      },);
      return {
        source: requireCount({
          value: record.source,
          path: `${entryPath}.source`,
        },),
        target: requireCount({
          value: record.target,
          path: `${entryPath}.target`,
        },),
      };
    },);
}

/**
 * Refuses a section whose pairs could not have come from a roster reply.
 *
 * @param pairs - pairs as recorded
 *
 * @param path - dotted path for error messages
 *
 * @throws {@link ArtifactParseError} naming the first position that breaks the
 * order the producer guarantees
 *
 * @example
 * ```ts
 * assertPairsAdvance({ pairs, path, },);
 * ```
 */
function assertPairsAdvance(
  {
    pairs,
    path,
  }: {
    readonly pairs: ArtifactSectionPairingV2['pairs'];
    readonly path: string;
  },
): void {
  for (const [at, pair,] of pairs.entries()) {
    /**
     * Pair before this one, absent at the first position.
     */
    const previous = pairs[at - 1];
    if (previous === undefined)
      continue;

    // A SPLIT REPEATS THE ORIGINAL and a merge repeats the translation, so
    // standing still on ONE side is the ordinary shape of this corpus, and both
    // happen in it. Only going backwards, or standing still on both at once, is
    // a pairing no reply could have carried.
    if ((pair.source < previous.source) || (pair.target < previous.target))
      throw new ArtifactParseError({
        path: `${path}[${String(at,)}]`,
        reason: `a pair at or after ${String(previous.source,)},${
          String(previous.target,)
        } on both sides, since both documents say things in the same order`,
      },);
    if ((pair.source === previous.source) && (pair.target === previous.target))
      throw new ArtifactParseError({
        path: `${path}[${String(at,)}]`,
        reason: 'a correspondence this section does not already make',
      },);
  }
}

/**
 * Refuses a list that repeats a section or records them out of order.
 *
 * ORDER IS CHECKED RATHER THAN IMPOSED, because the writer sorts and a list
 * arriving unsorted is therefore not one this pipeline wrote. Sorting it here
 * would accept that file and hide which run produced it.
 *
 * @param sections - sections as recorded
 *
 * @param path - dotted path for error messages
 *
 * @throws {@link ArtifactParseError} naming the first section out of place
 *
 * @example
 * ```ts
 * assertSectionsAscend({ sections, path, },);
 * ```
 */
function assertSectionsAscend(
  {
    sections,
    path,
  }: {
    readonly sections: readonly ArtifactSectionPairingV2[];
    readonly path: string;
  },
): void {
  for (const [at, section,] of sections.entries()) {
    /**
     * Section before this one, absent at the first position.
     */
    const previous = sections[at - 1];
    if (previous === undefined)
      continue;
    if (section.sectionIndex === previous.sectionIndex)
      throw new ArtifactParseError({
        path: `${path}[${String(at,)}].sectionIndex`,
        reason: `a section this list does not already carry, rather than ${String(section.sectionIndex,)} again`,
      },);
    if (section.sectionIndex < previous.sectionIndex)
      throw new ArtifactParseError({
        path: `${path}[${String(at,)}].sectionIndex`,
        reason: `a section above ${String(previous.sectionIndex,)}, since this list is recorded in section order`,
      },);
  }
}

/**
 * Reads the pairing a preparation records, or its absence.
 *
 * @param value - `blockPairing` as the artifact carries it, possibly absent
 *
 * @param alignmentPairCount - aligned sections this preparation reports, which
 * bounds every section index recorded here
 *
 * @param path - dotted path for error messages
 *
 * @returns Pairing it records, or a named absence
 *
 * @throws {@link ArtifactParseError} when the list is the wrong shape, names a
 * section this preparation does not have, repeats a section, records sections
 * out of order, or carries a pairing no roster reply could have produced
 *
 * @example
 * ```ts
 * const pairing = parseBlockPairingV2({ value: record.blockPairing, alignmentPairCount, path, },);
 * ```
 */
export function parseBlockPairingV2(
  {
    value,
    alignmentPairCount,
    path,
  }: {
    readonly value: unknown;
    readonly alignmentPairCount: number;
    readonly path: string;
  },
): ParsedBlockPairingV2 {
  if (value === undefined)
    return { kind: 'unrecorded', };

  /**
   * Sections as recorded, each checked against the shape this version names.
   */
  const sections = requireArray({
    value,
    path,
  },)
    .map(function readSection(
      entry,
      at,
    ): ArtifactSectionPairingV2 {
      /**
       * Where this section is reported from.
       */
      const entryPath = `${path}[${String(at,)}]`;

      /**
       * Section as a record.
       */
      const record = requireRecord({
        value: entry,
        path: entryPath,
      },);
      requireExactKeys({
        record,
        allowed: [
          'sectionIndex',
          'pairs',
        ],
        path: entryPath,
      },);

      /**
       * Aligned section this answers about.
       */
      const sectionIndex = requireCount({
        value: record.sectionIndex,
        path: `${entryPath}.sectionIndex`,
      },);

      // BOUNDED BY THE COUNT SITTING BESIDE IT, the way each lane's index sets
      // are bounded by the slice count. A pairing filed under a section this
      // preparation never aligned describes some other document.
      if (sectionIndex >= alignmentPairCount)
        throw new ArtifactParseError({
          path: `${entryPath}.sectionIndex`,
          reason: `a section below ${String(alignmentPairCount,)}, which is how many this preparation aligned`,
        },);

      /**
       * Correspondences agreed for it.
       */
      const pairs = parseSectionPairs({
        value: record.pairs,
        path: `${entryPath}.pairs`,
      },);
      assertPairsAdvance({
        pairs,
        path: `${entryPath}.pairs`,
      },);
      return {
        sectionIndex,
        pairs,
      };
    },);
  assertSectionsAscend({
    sections,
    path,
  },);
  return {
    kind: 'stored',
    sections,
  };
}

//endregion Artifact version 2 pairing read
