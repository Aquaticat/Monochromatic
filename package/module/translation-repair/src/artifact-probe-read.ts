import {
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
import type { RegionDefectTally, } from './introduced-defect-screen.ts';
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
    // Claims carry corpus quotes and nothing in the summary reads them, so they
    // are deliberately dropped here rather than parsed and carried around.
    claims: [],
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
   * Readings of the shipped records that carried telemetry.
   */
  const readings = shipped.flatMap(function toReading(entry,): readonly IssueProbeReading[] {
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
    return [
      {
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
    ];
  },);

  return {
    readings,
    shippedRecords: shipped.length,
    unprobedRecords: shipped.length - readings.length,
  };
}

//endregion Artifact probe reading
