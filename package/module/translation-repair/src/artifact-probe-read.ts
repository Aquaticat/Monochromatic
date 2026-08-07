import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
import type {
  ClaimAdmissibility,
  RegionDefectTally,
} from './introduced-defect-screen.ts';
import type { IssueProbeReading, } from './repair-record.ts';

//region Artifact probe reading
// Lifting shadow-mode probe readings back out of a settled artifact.
//
// Kept apart from `artifact-read.ts` on purpose. That reader feeds the
// PRECISION GATE, so it throws on anything malformed: a silently skipped
// accepted issue shrinks the gate denominator without a trace. This reader
// feeds a diagnostic, and the two failure modes are not the same. An artifact
// with no probe field is ordinary here (it predates the probe, or its chunk had
// nothing to replace) and must not throw. An artifact whose probe field IS
// present but malformed must throw, because that means the writer and the
// reader disagree and every count downstream is then unsound.
//
// Only SHIPPED records are read. The probe runs wherever an operation applied,
// including candidates selection later rejected, and the human repair sheet
// grades only what shipped. Reading the rest would put regions nobody judged
// into a rate about judged ones.

/**
 * Disposition whose repair reached the reader, and the only one graded.
 */
const SHIPPED_DISPOSITION = 'shipped';

/**
 * Every admissibility the screen can record.
 */
const ADMISSIBILITY_VALUES: readonly ClaimAdmissibility[] = [
  'corroborated',
  'removal-corroborated',
  'contradicted',
  'unanchored',
];

/**
 * Reads a claim's admissibility, refusing a value the screen cannot have
 * written.
 *
 * Narrowing rather than asserting, because the majority rule counts only the
 * two upheld values. An unrecognized string would be silently non-upholding, so
 * a writer emitting a new verdict name would quietly zero the corroboration
 * every region reports rather than announce that the schemas diverged.
 *
 * @param value - candidate admissibility from artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Admissibility as the screen recorded it
 *
 * @throws {@link ArtifactParseError} when the value is not one the screen emits
 *
 * @example
 * ```ts
 * const admissibility = requireAdmissibility({ value, path, },);
 * ```
 */
function requireAdmissibility(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ClaimAdmissibility {
  /**
   * Candidate as a string, which it must be before it can be one of the set.
   */
  const text = requireString({
    value,
    path,
  },);
  /**
   * Matching admissibility, absent when the writer emitted something else.
   */
  const found = ADMISSIBILITY_VALUES.find(function matches(candidate,) {
    return candidate === text;
  },);
  if (found === undefined)
    throw new ArtifactParseError({
      path,
      reason: `one of ${ADMISSIBILITY_VALUES.join(', ',)}`,
    },);
  return found;
}

/**
 * One probe reading together with the issue that owns it.
 *
 * @example
 * ```ts
 * const owned: OwnedProbeReading = { issueId: 'adjudicated/nap', reading, };
 * ```
 */
export type OwnedProbeReading = {
  /**
   * Issue whose record carried this reading.
   */
  readonly issueId: string;

  /**
   * Reading exactly as that record carried it.
   */
  readonly reading: IssueProbeReading;
};

/**
 * Probe readings of one artifact plus what it could not offer.
 *
 * @example
 * ```ts
 * const reading: ArtifactProbeReading = { readings: [], shippedRecords: 3, unprobedRecords: 1, };
 * ```
 */
export type ArtifactProbeReading = {
  /**
   * One reading per shipped record that carried probe telemetry.
   */
  readonly readings: readonly IssueProbeReading[];

  /**
   * The same readings, each paired with the issue whose record carried it.
   *
   * Ownership cannot be recovered from a reading alone. A reading's regions
   * name every issue each region serves, and one replacement can serve several
   * accepted issues, so an issue appears in the regions of every reading whose
   * record shared that replacement. Deciding ownership from those lists picks
   * an arbitrary one of them. Here the record is in hand, so the answer is
   * exact.
   */
  readonly owned: readonly OwnedProbeReading[];

  /**
   * Shipped records seen, probed or not, so a run whose probe never fired is
   * distinguishable from one that had nothing to ship.
   */
  readonly shippedRecords: number;

  /**
   * Shipped records carrying no probe field at all.
   */
  readonly unprobedRecords: number;
};

/**
 * Parses one region tally.
 *
 * @param value - candidate tally from artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Tally as the summary reads it
 *
 * @throws {@link ArtifactParseError} when any count or id is malformed
 *
 * @example
 * ```ts
 * const tally = parseRegionTally({ value, path: 'Kitten.issues[0]...regions[0]', },);
 * ```
 */
function parseRegionTally(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): RegionDefectTally {
  /**
   * Tally as a record.
   */
  const tally = requireRecord({
    value,
    path,
  },);

  /**
   * Reads one named count off the tally.
   *
   * @param field - count to read
   *
   * @returns Count value
   *
   * @example
   * ```ts
   * countAt('corroborated',);
   * ```
   */
  function countAt(field: string,): number {
    return requireCount({
      value: tally[field],
      path: `${path}.${field}`,
    },);
  }

  return {
    envelopeId: requireString({
      value: tally.envelopeId,
      path: `${path}.envelopeId`,
    },),
    issueIds: requireArray({
      value: tally.issueIds,
      path: `${path}.issueIds`,
    },)
      .map(function toId(
        entry,
        index,
      ) {
        return requireString({
          value: entry,
          path: `${path}.issueIds[${String(index,)}]`,
        },);
      },),
    corroborated: countAt('corroborated',),
    removalCorroborated: countAt('removalCorroborated',),
    contradicted: countAt('contradicted',),
    unanchored: countAt('unanchored',),
    noneFound: countAt('noneFound',),
    uncertain: countAt('uncertain',),
    // Claim IDENTITY only. The majority rule counts distinct probers, so the
    // verdict cannot be computed without modelId and admissibility, and reading
    // the counts alone silently judged every region as uncorroborated.
    //
    // The quote fields stay empty on purpose, which is the original reason this
    // list was dropped whole: `evidence`, `omittedText`, and `reason` carry
    // UNLICENSED corpus text, this reader feeds a summary that is meant to be
    // pasteable into a verdict, and nothing downstream of here reads them.
    // Parsing who said what is not the same as parsing what they quoted.
    claims: requireArray({
      value: tally.claims,
      path: `${path}.claims`,
    },)
      .map(function toClaim(
        entry,
        index,
      ) {
        /**
         * Claim as a record.
         */
        const claim = requireRecord({
          value: entry,
          path: `${path}.claims[${String(index,)}]`,
        },);
        return {
          modelId: requireString({
            value: claim.modelId,
            path: `${path}.claims[${String(index,)}].modelId`,
          },),
          admissibility: requireAdmissibility({
            value: claim.admissibility,
            path: `${path}.claims[${String(index,)}].admissibility`,
          },),
          category: '',
          severity: '',
          evidence: '',
          omittedText: '',
          reason: '',
        };
      },),
  };
}

/**
 * Reads probe telemetry out of one settled artifact.
 *
 * @param value - parsed artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Readings of its shipped records plus coverage counts
 *
 * @throws {@link ArtifactParseError} when a present probe field is malformed
 *
 * @example
 * ```ts
 * const reading = readArtifactProbe({ value, path: 'Kitten', },);
 * ```
 */
export function readArtifactProbe(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ArtifactProbeReading {
  /**
   * Artifact as a record.
   */
  const artifact = requireRecord({
    value,
    path,
  },);

  /**
   * Issue records the run wrote, or none when the artifact carries no report.
   */
  const records = artifact.issues === undefined
    ? []
    : requireArray({
      value: artifact.issues,
      path: `${path}.issues`,
    },);

  /**
   * Shipped records paired with their index, for error paths.
   */
  const shipped = records
    .map(function withIndex(
      entry,
      index,
    ) {
      return {
        record: requireRecord({
          value: entry,
          path: `${path}.issues[${String(index,)}]`,
        },),
        index,
      };
    },)
    .filter(function wasShipped(entry,) {
      return entry.record
        .repairDisposition
        === SHIPPED_DISPOSITION;
    },);

  /**
   * Readings of the shipped records that carried telemetry, each still paired
   * with the issue whose record carried it.
   */
  const owned = shipped.flatMap(function toReading(entry,): readonly OwnedProbeReading[] {
    /**
     * Probe field of this record, absent when the chunk was never probed.
     */
    const probe = entry.record
      .introducedDefects;
    if (probe === undefined)
      return [];

    /**
     * Path of this record's probe field.
     */
    const probePath = `${path}.issues[${String(entry.index,)}].introducedDefects`;

    /**
     * Probe reading as a record.
     */
    const reading = requireRecord({
      value: probe,
      path: probePath,
    },);
    /**
     * Adjudicated issue this record is about.
     */
    const issue = requireRecord({
      value: entry.record
        .issue,
      path: `${path}.issues[${String(entry.index,)}].issue`,
    },);

    return [
      {
        issueId: requireString({
          value: issue.issueId,
          path: `${path}.issues[${String(entry.index,)}].issue.issueId`,
        },),
        reading: {
          heardProbers: requireCount({
            value: reading.heardProbers,
            path: `${probePath}.heardProbers`,
          },),
          configuredProbers: requireCount({
            value: reading.configuredProbers,
            path: `${probePath}.configuredProbers`,
          },),
          regions: requireArray({
            value: reading.regions,
            path: `${probePath}.regions`,
          },)
            .map(function toTally(
              regionValue,
              regionIndex,
            ) {
              return parseRegionTally({
                value: regionValue,
                path: `${probePath}.regions[${String(regionIndex,)}]`,
              },);
            },),
        },
      },
    ];
  },);

  /**
   * Readings alone, for the aggregate summary that does not care which issue
   * owns which.
   */
  const readings = owned.map(function toReading(entry,) {
    return entry.reading;
  },);

  return {
    readings,
    owned,
    shippedRecords: shipped.length,
    unprobedRecords: shipped.length - readings.length,
  };
}

//endregion Artifact probe reading
