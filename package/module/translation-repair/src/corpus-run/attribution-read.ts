import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import type {
  AcceptedIssueView,
  AttributionEntry,
  ChunkCriticView,
  ProposerView,
} from './attribution-report.ts';

//region Attribution read
// Parses settled artifacts into the shape the attribution report needs,
// tolerating every field being absent. An artifact settled before attribution
// existed carries no `chunkCritics`, and that absence is DATA rather than a
// fault: the report counts those entries separately instead of reading them as
// critics that raised nothing.

/**
 * Reads the claim ids one adjudicated issue represents.
 *
 * @param issue - adjudicated issue block
 *
 * @returns Deterministic claim ids, empty when none parse
 *
 * @example
 * ```ts
 * const claimIds = readClaimIds({ issue, },);
 * ```
 */
function readClaimIds(
  {
    issue,
  }: {
    readonly issue: Record<string, unknown>;
  },
): readonly string[] {
  /**
   * Member claims of the issue.
   */
  const { claims, } = issue;
  if (!isJsonArray(claims,))
    return [];

  return claims.flatMap(function toId(member,) {
    if (!isJsonRecord(member,))
      return [];

    /**
     * Deterministic identity of this claim.
     */
    const { claimId, } = member;
    return ((typeof claimId) === 'string') ? [claimId,] : [];
  },);
}

/**
 * Reads one artifact's accepted-issue views.
 *
 * @param raw - parsed artifact
 *
 * @returns Issue views, empty when the artifact carries none
 *
 * @example
 * ```ts
 * const issues = readIssueViews({ raw, },);
 * ```
 */
function readIssueViews(
  {
    raw,
  }: {
    readonly raw: Record<string, unknown>;
  },
): readonly AcceptedIssueView[] {
  /**
   * Issue records of this artifact.
   */
  const { issues, } = raw;
  if (!isJsonArray(issues,))
    return [];

  return issues.flatMap(function toView(record,) {
    if (!isJsonRecord(record,))
      return [];

    /**
     * Adjudicated issue inside the record.
     */
    const { issue, } = record;
    if (!isJsonRecord(issue,))
      return [];

    /**
     * Adjudication status of the issue.
     */
    const { status, } = issue;

    return [{
      status: ((typeof status) === 'string') ? status : '',
      claimIds: readClaimIds({ issue, },),
    },];
  },);
}

/**
 * Reads the proposers of one recorded attribution.
 *
 * @param attribution - one recorded claim attribution
 *
 * @returns Proposers, empty when none parse
 *
 * @example
 * ```ts
 * const proposers = readProposers({ attribution, },);
 * ```
 */
function readProposers(
  {
    attribution,
  }: {
    readonly attribution: Record<string, unknown>;
  },
): readonly ProposerView[] {
  /**
   * Recorded proposer entries.
   */
  const { proposers, } = attribution;
  if (!isJsonArray(proposers,))
    return [];

  return proposers.flatMap(function toProposer(entry,) {
    if (!isJsonRecord(entry,))
      return [];

    /**
     * Critic that proposed the claim.
     */
    const { modelId, } = entry;

    /**
     * Times it emitted the claim.
     */
    const { emissionCount, } = entry;
    if (((typeof modelId) !== 'string') || ((typeof emissionCount) !== 'number'))
      return [];

    return [{
      modelId,
      emissionCount,
    },];
  },);
}

/**
 * Reads an artifact's per-chunk calibration.
 *
 * Takes the raw array rather than the artifact, so the caller establishes
 * PRESENCE and this only has to parse. Whether an artifact carries calibration
 * at all is the eligibility question the whole report rests on, and it belongs
 * beside the key that encodes it rather than inside a return value that has to
 * smuggle absence back out.
 *
 * @param chunkCritics - raw calibration array the artifact carries
 *
 * @returns Chunk views, dropping records that do not parse
 *
 * @example
 * ```ts
 * const views = readChunkCritics({ chunkCritics, },);
 * ```
 */
function readChunkCritics(
  {
    chunkCritics,
  }: {
    readonly chunkCritics: readonly unknown[];
  },
): readonly ChunkCriticView[] {
  return chunkCritics.flatMap(function toView(record,) {
    if (!isJsonRecord(record,))
      return [];

    /**
     * Chunk position this record describes.
     */
    const { chunkIndex, } = record;
    // Dropped rather than defaulted, like every other field in this parser. A
    // record with no usable index is not chunk 0; inventing one would inflate
    // the chunk count, which is the denominator every rate divides by.
    if ((typeof chunkIndex) !== 'number')
      return [];

    /**
     * Critics that answered on this chunk.
     */
    const { heardCriticIds, } = record;

    /**
     * Recorded attributions of this chunk.
     */
    const { claimAttributions, } = record;

    return [{
      chunkIndex,
      heardCriticIds: (isJsonArray(heardCriticIds,) ? heardCriticIds : [])
        .flatMap(function toModelId(modelId,) {
        return ((typeof modelId) === 'string') ? [modelId,] : [];
      },),
      claimAttributions: (isJsonArray(claimAttributions,) ? claimAttributions : [])
        .flatMap(function toAttribution(attribution,) {
        if (!isJsonRecord(attribution,))
          return [];

        /**
         * Deterministic identity of the attributed claim.
         */
        const { claimId, } = attribution;
        if ((typeof claimId) !== 'string')
          return [];

        return [{
          claimId,
          proposers: readProposers({ attribution, },),
        },];
      },),
    },];
  },);
}

/**
 * Reads one artifact into the shape the report needs.
 *
 * @param name - artifact file name, used as a fallback identifier
 *
 * @param parsed - parsed artifact
 *
 * @returns Entry view
 *
 * @example
 * ```ts
 * const entry = toEntry({ name, parsed, },);
 * ```
 */
function toEntry(
  {
    name,
    parsed,
  }: {
    readonly name: string;
    readonly parsed: unknown;
  },
): AttributionEntry {
  if (!isJsonRecord(parsed,)) {
    return {
      id: name,
      issues: [],
    };
  }

  /**
   * Entry identifier the artifact declares.
   */
  const { id, } = parsed;

  /**
   * Raw calibration, which an artifact settled before attribution lacks.
   */
  const { chunkCritics, } = parsed;

  return {
    id: ((typeof id) === 'string') ? id : name,
    // OMITTED rather than set to undefined or to an empty array. Absence is
    // what makes the entry ineligible, and an empty array would read instead as
    // an entry whose critics were asked and raised nothing.
    ...(isJsonArray(chunkCritics,)
      ? { chunkCritics: readChunkCritics({ chunkCritics, },), }
      : {}),
    issues: readIssueViews({ raw: parsed, },),
  };
}

/**
 * Reads every settled artifact into the shape the report needs.
 *
 * @param artifactsDir - directory the pass writes entries into
 *
 * @returns Entries in directory order
 *
 * @example
 * ```ts
 * const entries = await gatherAttributionEntries({ artifactsDir, },);
 * ```
 */
export async function gatherAttributionEntries(
  {
    artifactsDir,
  }: {
    readonly artifactsDir: string;
  },
): Promise<readonly AttributionEntry[]> {
  /**
   * Artifact file names.
   */
  const names = (await readdir(artifactsDir,)).filter(function isArtifact(name,) {
    return name.endsWith('.json',);
  },);

  return await Promise.all(names.map(async function readOne(name,): Promise<AttributionEntry> {
    /**
     * Raw artifact text.
     */
    const text = await readFile(
      join(
        artifactsDir,
        name,
      ),
      'utf8',
    );

    return toEntry({
      name,
      parsed: JSON.parse(text,),
    },);
  },),);
}

//endregion Attribution read
