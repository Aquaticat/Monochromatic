import {
  ArtifactParseError,
  requireArray,
  requireBoolean,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
import { parseRegionTally, } from './artifact-probe-tally.ts';
import type { TelemetryProbeReading, } from './probe-attribution.ts';
import {
  REPAIR_DISPOSITIONS,
  type RepairDisposition,
} from './repair-record.ts';

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
 * Reads a record's disposition, refusing a value the pipeline never writes.
 *
 * @param value - candidate disposition from artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Disposition as the pipeline recorded it
 *
 * @throws {@link ArtifactParseError} when the value is not one the pipeline
 * writes, since silently filing it under not-shipped changes a denominator
 *
 * @example
 * ```ts
 * const disposition = requireDisposition({ value, path, },);
 * ```
 */
function requireDisposition(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): RepairDisposition {
  /**
   * Candidate as a string, which it must be before it can be one of the set.
   */
  const text = requireString({
    value,
    path,
  },);
  /**
   * Matching disposition, absent when the writer emitted something else.
   */
  const found = REPAIR_DISPOSITIONS.find(function matches(candidate,) {
    return candidate === text;
  },);
  if (found === undefined)
    throw new ArtifactParseError({
      path,
      reason: `one of ${REPAIR_DISPOSITIONS.join(', ',)}`,
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
  readonly reading: TelemetryProbeReading;

  /**
   * Whether the naturalness lane rewrote this issue's slice afterwards.
   *
   * Carried because it decides whether the reading is about the text that
   * SHIPPED. The probe runs inside the accuracy stage, and the naturalness lane
   * runs after it over those outcomes, so on a refined slice the probe judged
   * wording the lane then replaced. The repair sheet shows the human the
   * returned wording and tells them to grade that, so joining a probe verdict
   * to a human repair grade silently compares two different texts exactly here.
   */
  readonly refined: boolean;
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
  readonly readings: readonly TelemetryProbeReading[];

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

  /**
   * Readings of the NATURALNESS lane's own rewrites.
   *
   * Kept as a flat list rather than deduplicated here, because every issue of a
   * rewritten slice carries the same report and the region ids are per slice
   * (`refinement/<chunkIndex>`). `summarizeProbeTelemetry` already collapses by
   * envelope id, so passing this list through it counts each rewrite once
   * rather than once per issue the slice happened to contain.
   */
  readonly refinementReadings: readonly TelemetryProbeReading[];
};

/**
 * Parses one probe reading, whichever edit produced it.
 *
 * Shared by the accuracy probe and the naturalness one, because the two audit
 * different edits and record the identical shape. Two copies of this would be
 * two chances for the readers to drift, and a reader that drifts from its
 * writer produces counts rather than errors.
 *
 * @param value - candidate reading from artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Reading as the summary reads it
 *
 * @throws {@link ArtifactParseError} when any count or region is malformed
 *
 * @example
 * ```ts
 * const reading = parseProbeReading({ value: probe, path, },);
 * ```
 */
function parseProbeReading(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): TelemetryProbeReading {
  /**
   * Reading as a record.
   */
  const reading = requireRecord({
    value,
    path,
  },);
  return {
    heardProbers: requireCount({
      value: reading.heardProbers,
      path: `${path}.heardProbers`,
    },),
    configuredProbers: requireCount({
      value: reading.configuredProbers,
      path: `${path}.configuredProbers`,
    },),
    regions: requireArray({
      value: reading.regions,
      path: `${path}.regions`,
    },)
      .map(function toTally(
        regionValue,
        regionIndex,
      ) {
        return parseRegionTally({
          value: regionValue,
          path: `${path}.regions[${String(regionIndex,)}]`,
        },);
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
      // Validated rather than compared directly. A disposition the pipeline
      // never writes, a typo included, is not "some other disposition": it
      // means writer and reader disagree, and a plain equality test would file
      // it under not-shipped, shrinking the denominator of a rate with nothing
      // anywhere recording that it happened.
      //
      // The repair reader deliberately does the opposite and keeps the
      // disposition an unnarrowed string, because there an unrecognized value
      // must still reach a human grader rather than drop the item. Here nobody
      // reads it, so silence is the only outcome.
      return requireDisposition({
        value: entry.record
          .repairDisposition,
        path: `${path}.issues[${String(entry.index,)}].repairDisposition`,
      },) === SHIPPED_DISPOSITION;
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
        refined: requireBoolean({
          value: entry.record
            .refined,
          path: `${path}.issues[${String(entry.index,)}].refined`,
        },),
        reading: parseProbeReading({
          value: probe,
          path: probePath,
        },),
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

  /**
   * Naturalness-rewrite readings, from the shipped records that carry one.
   *
   * Absent on every record of a slice the lane did not rewrite, and on every
   * artifact written before the lane was audited at all, so absence is ordinary
   * here exactly as it is for the accuracy probe.
   */
  const refinementReadings = shipped.flatMap(function toRefinement(entry,) {
    /**
     * Refinement probe field of this record.
     */
    const probe = entry.record
      .refinementDefects;
    if (probe === undefined)
      return [];
    return [
      parseProbeReading({
        value: probe,
        path: `${path}.issues[${String(entry.index,)}].refinementDefects`,
      },),
    ];
  },);

  return {
    readings,
    owned,
    shippedRecords: shipped.length,
    unprobedRecords: shipped.length - readings.length,
    refinementReadings,
  };
}

//endregion Artifact probe reading
