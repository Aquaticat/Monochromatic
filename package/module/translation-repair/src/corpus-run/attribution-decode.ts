import { ArtifactParseError, } from '../artifact-guard.ts';
import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import type {
  ChunkCriticView,
  ProposerView,
} from './attribution-report.ts';

//region Attribution decode
// STRICT decoding of the `chunkCritics` subtree, in deliberate contrast to how
// its ABSENCE is treated.
//
// Absence is data: an artifact settled before attribution existed carries no
// such key, and the report counts those entries separately rather than reading
// them as critics that raised nothing. A key that is PRESENT but malformed is
// not that. Tolerating it would move an artifact into the pre-feature
// population on the strength of corruption, and the eligible-versus-ineligible
// split is the one thing every number in the report rests on.
//
// So everything below throws rather than dropping. A dropped record produces a
// smaller denominator and a plausible-looking rate; a throw names the artifact
// and the path.

/**
 * Reads a value that must be a non-negative safe integer.
 *
 * `typeof value === 'number'` is not enough: it admits negatives, fractions,
 * and `Infinity`, which `JSON.parse` produces from `1e400`. Each of those would
 * travel into a count and out again as a rate.
 *
 * @param value - parsed value
 *
 * @param path - dotted path for the failure message
 *
 * @param minimum - smallest acceptable value
 *
 * @returns Validated integer
 *
 * @throws ArtifactParseError When not an integer at or above minimum
 *
 * @example
 * ```ts
 * const chunkIndex = readCount({ value, path: 'Kitten chunkCritics[0].chunkIndex', minimum: 0, },);
 * ```
 */
export function readCount(
  {
    value,
    path,
    minimum,
  }: {
    readonly value: unknown;
    readonly path: string;
    readonly minimum: number;
  },
): number {
  if (((typeof value) !== 'number') || (!Number.isSafeInteger(value,))
    || (value < minimum)) {
    throw new ArtifactParseError({
      path,
      reason: `a safe integer of at least ${String(minimum,)}`,
    },);
  }
  return value;
}

/**
 * Reads a value that must be an array of distinct strings.
 *
 * Distinctness is checked rather than assumed. `heardCriticIds` is a SET
 * written as an array, and a repeated member would count one critic twice on
 * one chunk, inflating the denominator every rate divides by.
 *
 * @param value - parsed value
 *
 * @param path - dotted path for the failure message
 *
 * @returns Validated strings
 *
 * @throws ArtifactParseError When not an array of distinct strings
 *
 * @example
 * ```ts
 * const heard = readDistinctStrings({ value, path: 'Kitten chunkCritics[0].heardCriticIds', },);
 * ```
 */
export function readDistinctStrings(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly string[] {
  if (!isJsonArray(value,))
    throw new ArtifactParseError({
      path,
      reason: 'an array',
    },);

  /**
   * Members, each of which must be a string.
   */
  const members = value.map(function toMember(
    member,
    index,
  ): string {
    if ((typeof member) !== 'string')
      throw new ArtifactParseError({
        path: `${path}[${String(index,)}]`,
        reason: 'a string',
      },);
    return member;
  },);

  if ((new Set(members,)).size !== members.length)
    throw new ArtifactParseError({
      path,
      reason: 'distinct members, since it is a set',
    },);

  return members;
}

/**
 * Decodes the proposers of one attribution.
 *
 * @param value - parsed proposers value
 *
 * @param path - dotted path for the failure message
 *
 * @returns Validated proposers
 *
 * @throws ArtifactParseError When malformed or naming one critic twice
 *
 * @example
 * ```ts
 * const proposers = decodeProposers({ value, path: 'Kitten chunkCritics[0].claimAttributions[0].proposers', },);
 * ```
 */
export function decodeProposers(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly ProposerView[] {
  if (!isJsonArray(value,))
    throw new ArtifactParseError({
      path,
      reason: 'an array',
    },);

  /**
   * One entry per critic that proposed the claim.
   */
  const proposers = value.map(function toProposer(
    entry,
    index,
  ): ProposerView {
    /**
     * Path of this proposer, for any failure below it.
     */
    const here = `${path}[${String(index,)}]`;
    if (!isJsonRecord(entry,))
      throw new ArtifactParseError({
        path: here,
        reason: 'a record',
      },);

    /**
     * Critic that proposed the claim.
     */
    const { modelId, } = entry;
    if ((typeof modelId) !== 'string')
      throw new ArtifactParseError({
        path: `${here}.modelId`,
        reason: 'a string',
      },);

    return {
      modelId,
      // At least one: a proposer that emitted the claim zero times is not a
      // proposer, and recording one would credit a critic that stayed silent.
      emissionCount: readCount({
        value: entry.emissionCount,
        path: `${here}.emissionCount`,
        minimum: 1,
      },),
    };
  },);

  if ((new Set(proposers.map(function toId(proposer,) {
    return proposer.modelId;
  },),)).size !== proposers.length) {
    throw new ArtifactParseError({
      path,
      reason: 'one entry per critic, since a repeat would double that critic\'s raised count',
    },);
  }

  return proposers;
}

/**
 * Decodes one chunk's calibration record.
 *
 * @param value - parsed record
 *
 * @param path - dotted path for the failure message
 *
 * @returns Validated chunk view
 *
 * @throws ArtifactParseError When malformed or repeating a claim id
 *
 * @example
 * ```ts
 * const view = decodeChunkRecord({ value, path: 'Kitten chunkCritics[0]', },);
 * ```
 */
export function decodeChunkRecord(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ChunkCriticView {
  if (!isJsonRecord(value,))
    throw new ArtifactParseError({
      path,
      reason: 'a record',
    },);

  /**
   * Recorded attributions of this chunk.
   */
  const rawAttributions = value.claimAttributions;
  if (!isJsonArray(rawAttributions,))
    throw new ArtifactParseError({
      path: `${path}.claimAttributions`,
      reason: 'an array',
    },);

  /**
   * One entry per claim that survived screening on this chunk.
   */
  const claimAttributions = rawAttributions.map(function toAttribution(
    entry,
    index,
  ) {
    /**
     * Path of this attribution.
     */
    const here = `${path}.claimAttributions[${String(index,)}]`;
    if (!isJsonRecord(entry,))
      throw new ArtifactParseError({
        path: here,
        reason: 'a record',
      },);

    /**
     * Deterministic identity of the attributed claim.
     */
    const { claimId, } = entry;
    if ((typeof claimId) !== 'string')
      throw new ArtifactParseError({
        path: `${here}.claimId`,
        reason: 'a string',
      },);

    return {
      claimId,
      proposers: decodeProposers({
        value: entry.proposers,
        path: `${here}.proposers`,
      },),
    };
  },);

  if ((new Set(claimAttributions.map(function toId(attribution,) {
    return attribution.claimId;
  },),)).size !== claimAttributions.length) {
    throw new ArtifactParseError({
      path: `${path}.claimAttributions`,
      reason: 'one entry per claim, since the writer keys them by claim id',
    },);
  }

  return {
    chunkIndex: readCount({
      value: value.chunkIndex,
      path: `${path}.chunkIndex`,
      minimum: 0,
    },),
    heardCriticIds: readDistinctStrings({
      value: value.heardCriticIds,
      path: `${path}.heardCriticIds`,
    },),
    claimAttributions,
  };
}

/**
 * Decodes an artifact's whole `chunkCritics` array.
 *
 * @param value - parsed array
 *
 * @param entryId - artifact identity, so a failure names the file
 *
 * @returns Validated chunk views
 *
 * @throws ArtifactParseError When malformed or repeating a chunk index
 *
 * @example
 * ```ts
 * const chunkCritics = decodeChunkCritics({ value, entryId: 'Kitten', },);
 * ```
 */
export function decodeChunkCritics(
  {
    value,
    entryId,
  }: {
    readonly value: unknown;
    readonly entryId: string;
  },
): readonly ChunkCriticView[] {
  if (!isJsonArray(value,)) {
    throw new ArtifactParseError({
      path: `${entryId} chunkCritics`,
      reason: 'an array when present at all, since only an ABSENT key means the entry predates attribution',
    },);
  }

  /**
   * One record per chunk of the document.
   */
  const records = value.map(function toRecord(
    record,
    index,
  ) {
    return decodeChunkRecord({
      value: record,
      path: `${entryId} chunkCritics[${String(index,)}]`,
    },);
  },);

  if ((new Set(records.map(function toIndex(record,) {
    return record.chunkIndex;
  },),)).size !== records.length) {
    throw new ArtifactParseError({
      path: `${entryId} chunkCritics`,
      reason: 'one record per chunk, since a repeat inflates the chunk count every rate divides by',
    },);
  }

  return records;
}

//endregion Attribution decode
