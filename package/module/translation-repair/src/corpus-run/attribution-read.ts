import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

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
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';

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
    readonly issue: Readonly<Record<string, unknown>>;
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
    readonly raw: Readonly<Record<string, unknown>>;
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
 * One artifact that could not be read at all.
 *
 * @example
 * ```ts
 * const failure: MalformedArtifact = { name: 'Kitten.json', reason: 'Unexpected end of JSON input', };
 * ```
 */
export type MalformedArtifact = {
  /**
   * File that failed, so a reader can go look at it.
   */
  readonly name: string;

  /**
   * Why it failed, named rather than summarized.
   */
  readonly reason: string;
};

/**
 * Everything a run directory yielded, including what it could not.
 *
 * @example
 * ```ts
 * const { entries, malformed, } = await gatherAttributionEntries({ artifactsDir, },);
 * ```
 */
export type AttributionGather = {
  /**
   * Entries that parsed.
   */
  readonly entries: readonly AttributionEntry[];

  /**
   * Artifacts that did not, held apart from the eligible and ineligible
   * populations rather than folded into either.
   */
  readonly malformed: readonly MalformedArtifact[];
};

/**
 * Reads every settled artifact into the shape the report needs.
 *
 * ISOLATED PER ARTIFACT, which is the difference between a loud failure and a
 * useless one. The decoding below throws by design, and a bare
 * `Promise.all` over the directory would let ONE bad file reject the whole
 * gather: a single truncated artifact would mean no calibration at all for
 * every other entry in the run. That is the same disproportion the writer
 * avoids by not throwing on a telemetry invariant.
 *
 * Half-written artifacts are a real case rather than a hypothetical one. A pass
 * killed at its hard cap can leave one, which is why `openSliceCache` already
 * treats a half-written slice as absent, and `JSON.parse` on it raises a
 * `SyntaxError` that has nothing to do with attribution.
 *
 * @param artifactsDir - directory the pass writes entries into
 *
 * @returns Entries that parsed, and the artifacts that did not
 *
 * @example
 * ```ts
 * const { entries, malformed, } = await gatherAttributionEntries({ artifactsDir, },);
 * ```
 */
export async function gatherAttributionEntries(
  {
    artifactsDir,
  }: {
    readonly artifactsDir: string;
  },
): Promise<AttributionGather> {
  /**
   * One directory listing, shared with the census.
   *
   * Taken once and threaded through, because the accumulation writes into this
   * directory continuously: a second listing inside the census would classify a
   * different set of files from the one this reader goes on to read.
   */
  const listed = (await readdir(artifactsDir,))
    .filter(function isArtifact(name,) {
      return name.endsWith('.json',);
    },);

  /**
   * Artifact file names.
   */
  const names = keepEligible({
    names: listed,
    eligible: await resolvePool({
      artifactsDir,
      names: listed,
    },),
  },);

  /**
   * One outcome per artifact: the entry it yielded, or why it yielded none.
   */
  const outcomes = await Promise.all(names.map(async function readOne(name,): Promise<
    { readonly entry: AttributionEntry; } | { readonly failure: MalformedArtifact; }
  > {
    try {
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

      return {
        entry: toEntry({
          name,
          parsed: JSON.parse(text,),
        },),
      };
    }
    catch (error) {
      // Recorded rather than rethrown, and never swallowed: the reason travels
      // to the caller, which reports it beside the population it is missing
      // from.
      return {
        failure: {
          name,
          reason: caughtValueText(error,),
        },
      };
    }
  },),);

  return {
    entries: outcomes.flatMap(function toEntries(outcome,): readonly AttributionEntry[] {
      return ('entry' in outcome) ? [outcome.entry,] : [];
    },),
    malformed: outcomes.flatMap(function toFailures(outcome,): readonly MalformedArtifact[] {
      return ('failure' in outcome) ? [outcome.failure,] : [];
    },),
  };
}

//endregion Attribution read
