import { readFile, } from 'node:fs/promises';

import { alignDocumentSections, } from '../chunk-document.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { parseDocument, } from '../parse-document.ts';
import { parseSampleManifest, } from '../sample-manifest.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from '../slice-pair.ts';
import { readArtifactRecords, } from './probe-relabel-artifact.ts';
import type { RelabelCase, } from './probe-relabel-case.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Probe relabel control
// Builds the arm that decides whether the damaged-region result means anything.
//
// Withholding the accepted issues made the probe raise claims on all five
// regions a human read as damaged, against none when they were shown. That is
// consistent with two very different stories. The list may be suppressing real
// detections, or the unlabelled prober may simply be reporting the PRE-EXISTING
// defect, which is the exact failure the list was added to prevent.
//
// Every damaged region is damaged by construction, so no claim raised there
// could be wrong and the two stories are indistinguishable. Regions the reader
// did NOT flag separate them: if the withheld arm is equally loud there, it is
// re-reporting old defects, and the whole finding collapses.
//
// Drawn from the SAME entries as the damaged regions so prose style, translator,
// and subject matter are held fixed, and the only thing that moves is whether a
// human saw damage.

/**
 * Control regions taken per entry.
 *
 * Two rather than one so a single unusual region cannot decide the arm, and not
 * more because each costs two prober calls and the comparison it feeds is a
 * rate, not a ranking.
 */
const CONTROL_REGIONS_PER_ENTRY = 2;

/**
 * Orders an entry's unflagged regions by how closely they match the damaged
 * region's replaced length.
 *
 * Taking whichever regions appear first makes the arm answer the wrong
 * question. Measured on the first control run, the unflagged regions that
 * happened to come first replaced 12 to 63 characters while the damaged regions
 * replaced 60 to 268, and a short replacement has less room to drop anything,
 * so a quiet control would have been partly a statement about length. Matching
 * length leaves the human verdict as the thing that differs.
 *
 * @param regions - unflagged regions of one entry, with their replaced lengths
 *
 * @param targetLength - replaced length of that entry's damaged region
 *
 * @returns Same regions, closest length first
 *
 * @example
 * ```ts
 * const ordered = byLengthDistance({ regions, targetLength: 189, },);
 * ```
 */
function byLengthDistance<Region extends { readonly before: string; },>(
  {
    regions,
    targetLength,
  }: {
    readonly regions: readonly Region[];
    readonly targetLength: number;
  },
): readonly Region[] {
  return regions
    .toSorted(function closerFirst(
      left,
      right,
    ) {
      /**
       * Replaced length of the left-hand region.
       */
      const leftLength = left.before
        .length;

      /**
       * Replaced length of the right-hand region.
       */
      const rightLength = right.before
        .length;

      return Math.abs(leftLength - targetLength,)
        - Math.abs(rightLength - targetLength,);
    },);
}

/**
 * Builds control cases from regions the reader did not flag.
 *
 * @param manifestPath - sample manifest naming the drawn entries
 *
 * @param damaged - damaged cases, whose envelopes are excluded
 *
 * @returns Control cases, at most {@link CONTROL_REGIONS_PER_ENTRY} per entry
 *
 * @throws {@link ArtifactParseError} when an artifact or manifest is malformed
 *
 * @example
 * ```ts
 * const controls = await gatherControlCases({ manifestPath, damaged, },);
 * ```
 */
export async function gatherControlCases(
  {
    manifestPath,
    damaged,
  }: {
    readonly manifestPath: string;
    readonly damaged: readonly RelabelCase[];
  },
): Promise<readonly RelabelCase[]> {
  /**
   * Drawn items, validated against their own contents.
   */
  const manifest = parseSampleManifest({
    value: JSON.parse(await readFile(
      manifestPath,
      'utf8',
    ),),
  },);

  /**
   * Envelopes already probed as damaged, which the control must exclude.
   */
  const flagged = new Set(
    damaged
      .map(function toKey(entry,) {
        /**
         * Envelope this damaged case probed.
         */
        const { envelopeId, } = entry.region;

        return `${entry.entryId} ${envelopeId}`;
      },),
  );

  /**
   * Entries the damaged regions came from, in draw order without repeats.
   */
  const entryIds = [
    ...new Set(
      damaged
        .map(function toEntryId(entry,) {
          return entry.entryId;
        },),
    ),
  ];

  /**
   * Control cases gathered so far.
   */
  const controls: RelabelCase[] = [];
  /* oxlint-disable no-await-in-loop -- sequential on purpose: one artifact and two git blobs per entry, and concurrency would multiply peak memory for no gain on a diagnostic */
  for (const entryId of entryIds) {
    /**
     * Settled records of this entry.
     */
    const records = await readArtifactRecords({ entryId, },);

    /**
     * Original document at the pinned commit.
     */
    const sourceText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${entryId}/page.md`,
    },);

    /**
     * Translation at the same commit.
     */
    const targetText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${entryId}/page.en.md`,
    },);

    /**
     * Slices of this entry, rebuilt as the pipeline builds them.
     */
    const slices = alignDocumentSections({
      source: parseDocument({ text: sourceText, },),
      target: parseDocument({ text: targetText, },),
    },)
      .pairs
      .flatMap(function toSlices(
        pair,
        index,
      ) {
        return subdivideChunkPair({
          pair,
          sourceText,
          targetText,
          baseIndex: index,
          budget: SLICE_CHAR_BUDGET,
        },);
      },);

    /**
     * Replaced length of this entry's damaged region, the length to match.
     */
    const targetLength = Math.max(
      0,
      ...damaged
        .filter(function isThisEntry(entry,) {
          return entry.entryId === entryId;
        },)
        .map(function toLength(entry,) {
          return entry.region
            .before
            .length;
        },),
    );

    /**
     * Every unflagged region of this entry, paired with its owning record and
     * ordered so the closest length in replaced text comes first.
     */
    const candidates = byLengthDistance({
      regions: records
        .flatMap(function toPairs(record,) {
          return record.repairRegions
            .map(function withOwner(region,) {
              return {
                record,
                region,
                before: region.before,
              };
            },);
        },)
        .filter(function isUnflagged(candidate,) {
          /**
           * Envelope this candidate would probe.
           */
          const { envelopeId, } = candidate.region;

          return !flagged.has(`${entryId} ${envelopeId}`,);
        },),
      targetLength,
    },);

    /**
     * Envelopes of this entry already taken, so one edit is probed once.
     */
    const taken = new Set<string>();
    for (const candidate of candidates) {
      /**
       * Region and the record that owns it.
       */
      const {
        record,
        region,
      } = candidate;
      if (taken.size >= CONTROL_REGIONS_PER_ENTRY)
        break;
      if (taken.has(region.envelopeId,))
        continue;

      /**
       * Slice whose translation carries this region.
       */
      const holder = slices
        .find(function holdsBefore(slice,) {
          return slice.target
            .text
            .includes(region.before,);
        },);
      if (holder === undefined)
        continue;

      taken.add(region.envelopeId,);
      controls.push({
        entryId,
        positions: [],
        region,
        issues: records
          .filter(function isServed(served,) {
            /**
             * Settled id of the candidate record.
             */
            const servedId = served.issue
              .issueId;

            return region.issueIds
              .includes(servedId,);
          },)
          .map(function toIssue(served,) {
            return served.issue;
          },),
        sourceText: holder.source
          .text,
        baselineText: holder.target
          .text,
        recorded: record.recorded[region.envelopeId] ?? 'not probed',
      },);
    }
  }
  /* oxlint-enable no-await-in-loop */

  return controls;
}

//endregion Probe relabel control
