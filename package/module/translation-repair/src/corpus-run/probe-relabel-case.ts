import { readFile, } from 'node:fs/promises';

import type { AdjudicatedIssue, } from '../adjudicate-model.ts';
import { ArtifactParseError, } from '../artifact-guard.ts';
import { alignDocumentSections, } from '../chunk-document.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { parseDocument, } from '../parse-document.ts';
import type { RepairRegion, } from '../repair-region.ts';
import { parseSampleManifest, } from '../sample-manifest.ts';
import {
  SLICE_CHAR_BUDGET,
  subdivideChunkPair,
} from '../slice-pair.ts';
import { readArtifactRecords, } from './probe-relabel-artifact.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Probe relabel cases
// Rebuilds the exact prober inputs for regions a HUMAN read as damaged, so the
// probe can be asked about them again under a changed prompt.
//
// The cat fixtures answered what the probe can do on clean, quotable damage:
// three voices of three. They cannot answer why it says nothing on real edits,
// because their damage is not the damage production makes. These cases are the
// opposite trade: real corpus text, and ground truth that came from reading
// rather than from the pipeline.
//
// Nothing here is written to the repository. Corpus text is read through git at
// the pinned commit and stays in memory.

/**
 * Sample positions whose repair a human read as damaged, with what was seen.
 *
 * From the round-three repair sheet, which was deliberately left ungraded
 * because the repairs were too broken to score. Written as records rather than
 * bare numbers so each position carries the observation that put it here; a
 * list of integers would say nothing about why these and not others.
 *
 * @example
 * ```ts
 * const first = DAMAGED_CASES[0]?.position;
 * ```
 */
export const DAMAGED_CASES = [
  {
    position: 2,
    damage: 'deleted a source-supported clause while fixing an addition claim',
  },
  {
    position: 7,
    damage: 'same edit, drawn again under a second accepted issue',
  },
  {
    position: 11,
    damage: 'deleted source-supported content beyond the quoted defect',
  },
  {
    position: 15,
    damage: 'deleted source-supported content beyond the quoted defect',
  },
  {
    position: 20,
    damage: 'reordered sentences the defect did not concern',
  },
  {
    position: 21,
    damage: 'deleted a contributor credit from an edit asked only to change a colon',
  },
  {
    position: 37,
    damage: 'replaced the sense of a verb, reminiscing became pleading',
  },
  {
    position: 43,
    damage: 'invented wording that appears in neither source nor translation',
  },
] as const;

/**
 * How much of a replaced text an error message quotes back.
 */
const QUOTE_PREVIEW_CHARS = 80;

/**
 * Positions {@link DAMAGED_CASES} names, for membership tests.
 */
const DAMAGED_POSITIONS: ReadonlySet<number> = new Set(
  DAMAGED_CASES.map(function toPosition(entry,) {
    return entry.position;
  },),
);

/**
 * Everything one prober call needs, rebuilt for a single damaged region.
 *
 * @example
 * ```ts
 * const [first,] = await gatherRelabelCases({ manifestPath, },);
 * ```
 */
export type RelabelCase = {
  /**
   * Corpus entry the region belongs to.
   */
  readonly entryId: string;

  /**
   * Sample positions that drew this region; more than one means the sheet
   * showed the same edit under several accepted issues.
   */
  readonly positions: readonly number[];

  /**
   * Region as the pipeline recorded it.
   */
  readonly region: RepairRegion;

  /**
   * Accepted issues the region served, exactly as production renders them.
   */
  readonly issues: readonly AdjudicatedIssue[];

  /**
   * Source text of the slice this region sits in.
   */
  readonly sourceText: string;

  /**
   * Translation of that slice before any replacement.
   */
  readonly baselineText: string;

  /**
   * What the probe said about this region during the run, for comparison.
   */
  readonly recorded: string;
};

/**
 * Finds the slice whose translation contains a region's replaced text.
 *
 * Located by CONTENT rather than by the recorded chunk index, because an index
 * carries a convention and a convention is the kind of thing that silently
 * shifts between a run and a later reading. Text either contains the region or
 * it does not.
 *
 * @param sourceText - whole original document
 *
 * @param targetText - whole translation
 *
 * @param before - replaced text to locate
 *
 * @returns Slice texts surrounding the region
 *
 * @throws {@link ArtifactParseError} when no slice carries the replaced text,
 * which means slicing no longer reproduces the run and every later comparison
 * would use a different prompt than production sent
 *
 * @example
 * ```ts
 * const slice = locateSlice({ sourceText, targetText, before, },);
 * ```
 */
function locateSlice(
  {
    sourceText,
    targetText,
    before,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
    readonly before: string;
  },
): {
  readonly sourceText: string;
  readonly baselineText: string;
} {
  /**
   * Aligned chunk pairs, rebuilt exactly as the pipeline builds them.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   * Paragraph-bound slices across every aligned section.
   */
  const slices = alignment.pairs
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
   * First slice whose translation carries the replaced text.
   */
  const holder = slices
    .find(function holdsBefore(slice,) {
      return slice.target
        .text
        .includes(before,);
    },);
  if (holder === undefined) {
    throw new ArtifactParseError({
      path: `slice holding ${
        JSON.stringify(before.slice(
          0,
          QUOTE_PREVIEW_CHARS,
        ),)
      }`,
      reason:
        'present in one slice; absence means slicing no longer reproduces the run, so any comparison would use a different prompt than production sent',
    },);
  }

  return {
    sourceText: holder.source
      .text,
    baselineText: holder.target
      .text,
  };
}

/**
 * Rebuilds every damaged-region case named by {@link DAMAGED_CASES}.
 *
 * @param manifestPath - sample manifest the positions index into
 *
 * @returns One case per distinct region, in sample order
 *
 * @throws {@link ArtifactParseError} when a manifest, artifact, or slice lookup
 * does not reproduce the run
 *
 * @example
 * ```ts
 * const cases = await gatherRelabelCases({ manifestPath, },);
 * ```
 */
export async function gatherRelabelCases(
  { manifestPath, }: { readonly manifestPath: string; },
): Promise<readonly RelabelCase[]> {
  /**
   * Drawn items, validated and digest-checked against their own contents.
   */
  const manifest = parseSampleManifest({
    value: JSON.parse(await readFile(
      manifestPath,
      'utf8',
    ),),
  },);

  /**
   * Drawn items this rebuild probes.
   */
  const wanted = manifest.items
    .filter(function isDamaged(item,) {
      return DAMAGED_POSITIONS.has(item.position,);
    },);

  /**
   * Cases keyed by entry and envelope, so one edit drawn twice is probed once.
   */
  const byRegion = new Map<string, RelabelCase>();
  /* oxlint-disable no-await-in-loop -- sequential on purpose: each iteration reads one artifact and two git blobs, and running them together would multiply peak memory by the entry count for no wall-clock gain on a diagnostic */
  for (const item of wanted) {
    /**
     * Settled records of the entry this item was drawn from.
     */
    const records = await readArtifactRecords({ entryId: item.entryId, },);

    /**
     * Record carrying the drawn issue.
     */
    const drawn = records
      .find(function isDrawn(candidate,) {
        /**
         * Settled id of the candidate record.
         */
        const candidateId = candidate.issue
          .issueId;

        return candidateId === item.issueId;
      },);
    if (drawn === undefined)
      continue;

    /**
     * Original document at the pinned commit.
     */
    const sourceText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${item.entryId}/page.md`,
    },);

    /**
     * Translation at the same commit.
     */
    const targetText = await readCorpusFile({
      pin: RUN_CORPUS_PIN,
      relPath: `people/${item.entryId}/page.en.md`,
    },);

    for (const region of drawn.repairRegions) {
      /**
       * Identity of this edit within the corpus.
       */
      const key = `${item.entryId} ${region.envelopeId}`;

      /**
       * Case an earlier position already built for this edit.
       */
      const seen = byRegion.get(key,);
      if (seen !== undefined) {
        byRegion.set(
          key,
          {
            ...seen,
            positions: [
              ...seen.positions,
              item.position,
            ],
          },
        );
        continue;
      }

      byRegion.set(
        key,
        {
          entryId: item.entryId,
          positions: [item.position,],
          region,
          issues: records
            .filter(function isServed(candidate,) {
              return region.issueIds
                .includes(candidate.issue
                  .issueId,);
            },)
            .map(function toIssue(candidate,) {
              return candidate.issue;
            },),
          ...locateSlice({
            sourceText,
            targetText,
            before: region.before,
          },),
          recorded: drawn.recorded[region.envelopeId] ?? 'not probed',
        },
      );
    }
  }
  /* oxlint-enable no-await-in-loop */

  return [...byRegion.values(),];
}

//endregion Probe relabel cases
