import {
  requireArray,
  requireCount,
} from '../artifact-guard.ts';
import {
  requireOneOf,
  requireOpenRecord,
} from '../artifact-exact-guard.ts';
import type {
  ArtifactRepairEvidenceV2,
  ArtifactTranslateEvidenceV2,
} from './artifact-v2-read-contract.ts';
import { parseEvidenceRowV2, } from './artifact-v2-read-rows.ts';

//region Artifact version 2 evidence parsing
// Taking what version 2 requires OUT of the two raw lane results, which it
// otherwise leaves alone.
//
// BOTH LANES IN ONE FILE, rather than one file each as the seam sketch had it:
// the two parsers differ by three fields, they share the index-list reading
// below, and splitting them would put the shared part somewhere neither lane
// owns. Either grows a file of its own the day it needs more than this.
//
// TOLERANT, and deliberately so. These records are typed by the live pipeline,
// they have gained fields before and will again, and requiring today's shape
// would make every later addition a retroactive requirement on artifacts
// already written. What each parser reads is exactly what a relation later
// checks: the ledger against the evidence, the counts against their own lists,
// and the blocked status against what the deliveries say.

/**
 * Reads a list of slice indices.
 *
 * @param value - list JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Indices in the order the file lists them, which is the order the
 * relations read them in
 *
 * @throws {@link ArtifactParseError} when the value is not an array, or any
 * element is not an index any preparation could have produced
 *
 * @example
 * ```ts
 * const shipped = requireIndexList({ value: record.shippedChunkIndices, path, },);
 * ```
 */
function requireIndexList(
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
    .map(function readIndex(
      held,
      position,
    ): number {
      return requireCount({
        value: held,
        path: `${path}[${String(position,)}]`,
      },);
    },);
}

/**
 * Reads what version 2 requires of the repair lane's raw result.
 *
 * @param value - raw result JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Evidence core, with the rest of the record left where it is
 *
 * @throws {@link ArtifactParseError} when a field version 2 checks is missing,
 * the wrong shape, or names a status this version does not describe
 *
 * @example
 * ```ts
 * const evidence = parseRepairEvidenceV2({ value: raw, path: 'lanes.repair.result', },);
 * ```
 */
export function parseRepairEvidenceV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactRepairEvidenceV2 {
  /**
   * Raw result as a record, whose other fields stay unread.
   */
  const record = requireOpenRecord({
    value,
    path,
  },);
  return {
    status: requireOneOf({
      value: record.status,
      allowed: [
        'repaired',
        'unchanged',
        'blocked-non-translation',
      ],
      path: `${path}.status`,
    },),
    sliceCount: requireCount({
      value: record.sliceCount,
      path: `${path}.sliceCount`,
    },),
    shippedChunkIndices: requireIndexList({
      value: record.shippedChunkIndices,
      path: `${path}.shippedChunkIndices`,
    },),
    withdrawnChunkIndices: requireIndexList({
      value: record.withdrawnChunkIndices,
      path: `${path}.withdrawnChunkIndices`,
    },),
    sliceTexts: requireArray({
      value: record.sliceTexts,
      path: `${path}.sliceTexts`,
    },)
      .map(function readRow(
        row,
        position,
      ) {
        return parseEvidenceRowV2({
          value: row,
          path: `${path}.sliceTexts[${String(position,)}]`,
        },);
      },),
  };
}

/**
 * Reads what version 2 requires of the translate lane's raw result.
 *
 * @param value - raw result JSON
 *
 * @param path - dotted path for error message
 *
 * @returns Evidence core, with the rest of the record left where it is
 *
 * @throws {@link ArtifactParseError} when a field version 2 checks is missing,
 * the wrong shape, or names a status this version does not describe
 *
 * @example
 * ```ts
 * const evidence = parseTranslateEvidenceV2({ value: raw, path: 'lanes.translate.result', },);
 * ```
 */
export function parseTranslateEvidenceV2(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactTranslateEvidenceV2 {
  /**
   * Raw result as a record, whose other fields stay unread.
   */
  const record = requireOpenRecord({
    value,
    path,
  },);
  return {
    status: requireOneOf({
      value: record.status,
      allowed: [
        'complete',
        'unfilled',
      ],
      path: `${path}.status`,
    },),
    sliceCount: requireCount({
      value: record.sliceCount,
      path: `${path}.sliceCount`,
    },),
    changedSliceCount: requireCount({
      value: record.changedSliceCount,
      path: `${path}.changedSliceCount`,
    },),
    withdrawnSliceCount: requireCount({
      value: record.withdrawnSliceCount,
      path: `${path}.withdrawnSliceCount`,
    },),
    shippedChunkIndices: requireIndexList({
      value: record.shippedChunkIndices,
      path: `${path}.shippedChunkIndices`,
    },),
    withdrawnChunkIndices: requireIndexList({
      value: record.withdrawnChunkIndices,
      path: `${path}.withdrawnChunkIndices`,
    },),
    sliceTexts: requireArray({
      value: record.sliceTexts,
      path: `${path}.sliceTexts`,
    },)
      .map(function readRow(
        row,
        position,
      ) {
        return parseEvidenceRowV2({
          value: row,
          path: `${path}.sliceTexts[${String(position,)}]`,
        },);
      },),
  };
}

//endregion Artifact version 2 evidence parsing
