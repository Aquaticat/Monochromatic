import {
  checkedChangeSets,
  orderedChangeSets,
} from './assembly-invariant.ts';
import {
  ArtifactParseError,
  requireArray,
  requireCount,
} from './artifact-guard.ts';
import { readArtifactSchemaVersion, } from './artifact-schema-version.ts';

//region Artifact change sets
// Which slices a settled run's document carried a change for, read back out of
// the artifact with absence kept absent.
//
// The one rule this file exists for: an artifact that never recorded these sets
// must not read as a run that changed nothing. Both are an empty array once a
// reader defaults them, and the difference between "we did not write this down"
// and "this run shipped no repair" is the difference between an unknown and a
// measurement.

/**
 * What a settled artifact says about the slices its document changed.
 *
 * THREE KINDS BECAUSE THERE ARE THREE ANSWERS, and folding any two of them
 * together is exactly the defect this replaces. The sets can be absent, present
 * with the count they are out of, or present without it: an artifact written on
 * 2026-08-15 carries both index arrays and no `sliceCount`, so nothing can
 * range-check them, while everything else about them is still checkable.
 *
 * @example
 * ```ts
 * const sets: ArtifactChangeSets = { kind: 'unrecorded', };
 * ```
 */
export type ArtifactChangeSets = {
  /**
   * Run predates index recording, so which slices it changed is unknown. NOT
   * the same as a run that changed nothing, and readers must not treat it so.
   */
  readonly kind: 'unrecorded';
} | {
  /**
   * Both sets are recorded, and no `sliceCount` bounds them.
   */
  readonly kind: 'uncounted';

  /**
   * Slices the document carries a change for, ascending.
   */
  readonly shipped: readonly number[];

  /**
   * Slices whose change the assembly guard took back, ascending.
   */
  readonly withdrawn: readonly number[];
} | {
  /**
   * Both sets are recorded, bounded by the slices the preparation produced.
   */
  readonly kind: 'counted';

  /**
   * Slices the preparation produced, which both sets are out of.
   */
  readonly sliceCount: number;

  /**
   * Slices the document carries a change for, ascending.
   */
  readonly shipped: readonly number[];

  /**
   * Slices whose change the assembly guard took back, ascending.
   */
  readonly withdrawn: readonly number[];
};

/**
 * Reads one index array, requiring every entry to be a slice index.
 *
 * @param value - array as parsed from JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Every index, in the order the artifact recorded them
 *
 * @throws {@link ArtifactParseError} when the value is not an array of
 * non-negative whole numbers
 *
 * @example
 * ```ts
 * const shipped = readIndexArray({ value: artifact.shippedChunkIndices, path: `${id}.shippedChunkIndices`, },);
 * ```
 */
function readIndexArray(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly number[] {
  return requireArray({
    value,
    path,
  },)
    .map(function readIndexAt(
      entry,
      entryIndex,
    ): number {
      return requireCount({
        value: entry,
        path: `${path}[${String(entryIndex,)}]`,
      },);
    },);
}

/**
 * Reads both index sets out of a settled artifact.
 *
 * DISPATCHES ON THE VERSION, then on presence, and refuses the shapes no writer
 * has ever produced. Exactly one of the two arrays is the important refusal:
 * every generation wrote both or neither, so one alone means an artifact was
 * edited, merged, or truncated, and reading its lone array would report a
 * shipped set with no withdrawals or the reverse as though a run had said so.
 *
 * A VERSIONED ARTIFACT MUST CARRY BOTH, plus the `sliceCount` they are out of.
 * That is what the version buys: presence stops being a question, so a missing
 * field is a defect rather than a generation.
 *
 * THE VALIDATION FAILURES ARRIVE AS `AssemblyContractError`, not as
 * {@link ArtifactParseError}, and that is deliberate rather than an oversight.
 * A repeat, an overlap or an out-of-range index is a broken CONTRACT that the
 * writing lane was supposed to have upheld, and it reads identically whether it
 * was found at assembly or in a file afterwards. Re-wrapping it here would tell
 * a reader the file is malformed when what is malformed is the run that wrote
 * it.
 *
 * @param artifact - artifact record, freshly parsed
 *
 * @param path - dotted path for error messages, usually the entry id
 *
 * @returns Both sets with their generation named
 *
 * @throws {@link ArtifactParseError} when one index array is present without
 * the other, when a versioned artifact omits either of them or `sliceCount`, or
 * when an index is not a non-negative whole number
 *
 * @throws AssemblyContractError when the recorded sets repeat an index, name a
 * slice as both shipped and withdrawn, or fall outside the recorded slice count
 *
 * @example
 * ```ts
 * const sets = readArtifactChangeSets({ artifact, path: id, },);
 * ```
 */
export function readArtifactChangeSets(
  {
    artifact,
    path,
  }: {
    readonly artifact: Readonly<Record<string, unknown>>;
    readonly path: string;
  },
): ArtifactChangeSets {
  /**
   * Generation the artifact names, or a named absence.
   */
  const reading = readArtifactSchemaVersion({
    artifact,
    path,
  },);

  /**
   * Whether the shipped set was written at all, by key rather than by value, so
   * an explicit JSON `null` counts as present and is refused below rather than
   * passing for an artifact that predates the field.
   */
  const hasShipped = Object.hasOwn(
    artifact,
    'shippedChunkIndices',
  );

  /**
   * Whether the withdrawn set was written at all.
   */
  const hasWithdrawn = Object.hasOwn(
    artifact,
    'withdrawnChunkIndices',
  );
  if (hasShipped !== hasWithdrawn)
    throw new ArtifactParseError({
      path: `${path}.${hasShipped ? 'withdrawnChunkIndices' : 'shippedChunkIndices'}`,
      reason: 'both index sets or neither, since every generation wrote them together',
    },);

  if (reading.kind === 'unversioned') {
    if (!hasShipped)
      return { kind: 'unrecorded', };
    return {
      kind: 'uncounted',
      ...checkedChangeSets({
        shipped: readIndexArray({
          value: artifact.shippedChunkIndices,
          path: `${path}.shippedChunkIndices`,
        },),
        withdrawn: readIndexArray({
          value: artifact.withdrawnChunkIndices,
          path: `${path}.withdrawnChunkIndices`,
        },),
      },),
    };
  }

  if (!hasShipped)
    throw new ArtifactParseError({
      path: `${path}.shippedChunkIndices`,
      reason: `index sets, which schema version ${String(reading.version,)} records for every run`,
    },);

  /**
   * Slices the preparation produced, which bounds both sets.
   */
  const sliceCount = requireCount({
    value: artifact.sliceCount,
    path: `${path}.sliceCount`,
  },);

  return {
    kind: 'counted',
    sliceCount,
    ...orderedChangeSets({
      sliceCount,
      shipped: readIndexArray({
        value: artifact.shippedChunkIndices,
        path: `${path}.shippedChunkIndices`,
      },),
      withdrawn: readIndexArray({
        value: artifact.withdrawnChunkIndices,
        path: `${path}.withdrawnChunkIndices`,
      },),
    },),
  };
}

//endregion Artifact change sets
