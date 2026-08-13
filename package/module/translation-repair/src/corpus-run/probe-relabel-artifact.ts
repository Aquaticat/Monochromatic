import { readFile, } from 'node:fs/promises';

import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import {
  ArtifactParseError,
  requireArray,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import {
  type IssueCategory,
  isIssueCategory,
  isIssueSeverity,
  type IssueSeverity,
} from '../issue-taxonomy.ts';
import type { RepairRegion, } from '../repair-region.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Probe relabel artifact reading
// Reads a settled artifact back into the shapes a prober call needs.
//
// Kept apart from the case rebuild because these two answer different
// questions: this one is about what the run RECORDED, and the rebuild is about
// what the prompt CONTAINED.

/**
 * One settled issue record, narrowed to what a rebuild reads.
 *
 * @example
 * ```ts
 * const [record,] = await readArtifactRecords({ entryId: 'Acheron', },);
 * ```
 */
export type ArtifactRecord = {
  /**
   * Accepted issue as the prompt renders it.
   */
  readonly issue: AdjudicatedIssue;

  /**
   * Replacements the accuracy stage applied for this record.
   */
  readonly repairRegions: readonly RepairRegion[];

  /**
   * Probe tallies keyed by envelope, already rendered for printing.
   */
  readonly recorded: Readonly<Record<string, string>>;
};

/**
 * Counts a recorded probe tally prints, in reading order.
 */
const TALLY_FIELDS: readonly string[] = [
  'corroborated',
  'removalCorroborated',
  'noneFound',
  'uncertain',
];

/**
 * Reads a severity, rejecting anything outside the taxonomy.
 *
 * @param value - severity as written in the artifact
 *
 * @param path - dotted path for the failure message
 *
 * @returns Severity as a taxonomy member
 *
 * @throws {@link ArtifactParseError} when the value names no known severity
 *
 * @example
 * ```ts
 * const severity = requireSeverity({ value: record.severity, path: 'issue.severity', },);
 * ```
 */
function requireSeverity(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): IssueSeverity {
  if (!isIssueSeverity(value,)) {
    throw new ArtifactParseError({
      path,
      reason: 'one of the taxonomy severities',
    },);
  }
  return value;
}

/**
 * Reads a claim category, rejecting anything outside the taxonomy.
 *
 * @param value - category as written in the artifact
 *
 * @param path - dotted path for the failure message
 *
 * @returns Category as a taxonomy member
 *
 * @throws {@link ArtifactParseError} when the value names no known category
 *
 * @example
 * ```ts
 * const category = requireCategory({ value: claim.category, path: 'claim.category', },);
 * ```
 */
function requireCategory(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): IssueCategory {
  if (!isIssueCategory(value,)) {
    throw new ArtifactParseError({
      path,
      reason: 'one of the taxonomy categories',
    },);
  }
  return value;
}

/**
 * Rebuilds the accepted issue as the prober sheet renders it.
 *
 * Only the three fields `renderPriorIssues` prints are reconstructed, and spans
 * and tallies are left empty on purpose. Parsing evidence offsets here would
 * carry a shape the prompt never shows, and inventing one would make the
 * rebuild diverge from production in a way nothing would catch.
 *
 * @param value - one `issues[].issue` of an artifact
 *
 * @returns Issue carrying its id, severity, and claim summaries
 *
 * @throws {@link ArtifactParseError} when a rendered field is malformed
 *
 * @example
 * ```ts
 * const issue = readRenderedIssue({ value, },);
 * ```
 */
function readRenderedIssue(
  { value, }: { readonly value: unknown; },
): AdjudicatedIssue {
  /**
   * Issue as a record.
   */
  const record = requireRecord({
    value,
    path: 'issue',
  },);

  return {
    issueId: requireString({
      value: record.issueId,
      path: 'issue.issueId',
    },),
    status: 'accepted',
    severity: requireSeverity({
      value: record.severity,
      path: 'issue.severity',
    },),
    claims: requireArray({
      value: record.claims,
      path: 'issue.claims',
    },)
      .map(function toClaim(entry,) {
        /**
         * Claim wrapper as a record.
         */
        const member = requireRecord({
          value: entry,
          path: 'issue.claims[]',
        },);

        /**
         * Claim body carrying what the sheet prints.
         */
        const claim = requireRecord({
          value: member.claim,
          path: 'issue.claims[].claim',
        },);

        return {
          claimId: requireString({
            value: member.claimId,
            path: 'issue.claims[].claimId',
          },),
          claim: {
            category: requireCategory({
              value: claim.category,
              path: 'issue.claims[].claim.category',
            },),
            severity: requireSeverity({
              value: claim.severity,
              path: 'issue.claims[].claim.severity',
            },),
            summary: requireString({
              value: claim.summary,
              path: 'issue.claims[].claim.summary',
            },),
            spans: [],
          },
        };
      },),
    tallies: {},
  };
}

/**
 * Reads one region out of an artifact's raw JSON.
 *
 * @param value - one element of a record's `repairRegions`
 *
 * @returns Region with its texts
 *
 * @throws {@link ArtifactParseError} when a field is malformed
 *
 * @example
 * ```ts
 * const region = readRegion({ value, },);
 * ```
 */
function readRegion({ value, }: { readonly value: unknown; },): RepairRegion {
  /**
   * Region as a record.
   */
  const record = requireRecord({
    value,
    path: 'repairRegion',
  },);

  return {
    envelopeId: requireString({
      value: record.envelopeId,
      path: 'repairRegion.envelopeId',
    },),
    issueIds: requireArray({
      value: record.issueIds,
      path: 'repairRegion.issueIds',
    },)
      .map(function toId(entry,) {
        return requireString({
          value: entry,
          path: 'repairRegion.issueIds[]',
        },);
      },),
    before: requireString({
      value: record.before,
      path: 'repairRegion.before',
    },),
    editorAfter: requireString({
      value: record.editorAfter,
      path: 'repairRegion.editorAfter',
    },),
  };
}

/**
 * Renders one region's recorded probe tally as a printable line.
 *
 * @param value - one element of `introducedDefects.regions`
 *
 * @returns Envelope id paired with its counts
 *
 * @throws {@link ArtifactParseError} when the envelope id is malformed
 *
 * @example
 * ```ts
 * const [id, line,] = readRecordedTally({ value, },);
 * ```
 */
function readRecordedTally({ value, }: { readonly value: unknown; },): readonly [
  string,
  string,
] {
  /**
   * Tally as a record.
   */
  const record = requireRecord({
    value,
    path: 'introducedDefects.region',
  },);

  /**
   * Counts rendered through JSON so a field of an unexpected type prints as
   * itself rather than as a default stringification.
   */
  const counts = TALLY_FIELDS
    .map(function toCount(field,) {
      return `${field}=${JSON.stringify(record[field] ?? 0,)}`;
    },)
    .join(' ',);

  return [
    requireString({
      value: record.envelopeId,
      path: 'introducedDefects.region.envelopeId',
    },),
    counts,
  ];
}

/**
 * Reads the recorded probe tallies of one settled record.
 *
 * @param record - one `issues[]` element as a record
 *
 * @returns Rendered tally per envelope, empty when the record was never probed
 *
 * @example
 * ```ts
 * const recorded = readRecordedTallies({ record, },);
 * ```
 */
function readRecordedTallies(
  { record, }: { readonly record: Readonly<Record<string, unknown>>; },
): Readonly<Record<string, string>> {
  /**
   * Probe block, absent on a record the stage never probed.
   */
  const probe = record.introducedDefects;
  if ((typeof probe) !== 'object')
    return {};
  if (probe === null)
    return {};
  if (!('regions' in probe))
    return {};

  return Object.fromEntries(
    requireArray({
      value: probe.regions,
      path: 'introducedDefects.regions',
    },)
      .map(function toTally(entry,) {
        return readRecordedTally({ value: entry, },);
      },),
  );
}

/**
 * Reads one artifact into the records a rebuild needs.
 *
 * @param entryId - corpus entry id
 *
 * @returns Settled records carrying issues, regions, and recorded tallies
 *
 * @throws {@link ArtifactParseError} when the artifact is malformed
 *
 * @example
 * ```ts
 * const records = await readArtifactRecords({ entryId: 'Acheron', },);
 * ```
 */
export async function readArtifactRecords(
  { entryId, }: { readonly entryId: string; },
): Promise<readonly ArtifactRecord[]> {
  /**
   * Run artifact root for this checkout.
   */
  const dir = await resolveRunsDir();

  /**
   * Artifact as a record.
   */
  const artifact = requireRecord({
    value: JSON.parse(await readFile(
      `${dir}/artifacts/${entryId}.json`,
      'utf8',
    ),),
    path: `artifact ${entryId}`,
  },);

  return requireArray({
    value: artifact.issues,
    path: `artifact ${entryId}.issues`,
  },)
    .map(function toRecord(value,): ArtifactRecord {
      /**
       * Issue record as a record.
       */
      const record = requireRecord({
        value,
        path: `artifact ${entryId}.issues[]`,
      },);

      return {
        issue: readRenderedIssue({ value: record.issue, },),
        repairRegions: requireArray({
          value: record.repairRegions ?? [],
          path: 'repairRegions',
        },)
          .map(function toRegion(entry,) {
            return readRegion({ value: entry, },);
          },),
        recorded: readRecordedTallies({ record, },),
      };
    },);
}

//endregion Probe relabel artifact reading
