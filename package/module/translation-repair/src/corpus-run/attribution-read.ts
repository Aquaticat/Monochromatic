import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { ArtifactParseError, } from '../artifact-guard.ts';
import {
  isJsonArray,
  isJsonRecord,
} from '../json-guard.ts';
import { decodeChunkCritics, } from './attribution-decode.ts';
import type {
  AcceptedIssueView,
  AttributionEntry,
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
  if (!isJsonRecord(parsed,))
    throw new ArtifactParseError({
      path: name,
      reason: 'a record',
    },);

  /**
   * Entry identifier the artifact declares.
   */
  const { id, } = parsed;

  /**
   * Identity used in any failure message below, so a throw names the file.
   */
  const entryId = ((typeof id) === 'string') ? id : name;

  return {
    id: entryId,
    // ABSENT versus MALFORMED, and the difference decides the population. An
    // artifact settled before attribution existed has no such key, and the key
    // being OMITTED here is what makes the entry ineligible. A key that is
    // present but not an array is corruption, and letting it fall through to
    // the same omission would move a broken artifact into the pre-feature
    // population on the strength of its own breakage.
    ...(('chunkCritics' in parsed)
      ? {
        chunkCritics: decodeChunkCritics({
          value: parsed.chunkCritics,
          entryId,
        },),
      }
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
