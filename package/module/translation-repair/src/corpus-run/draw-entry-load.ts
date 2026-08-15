import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';


import { parseSettledArtifact, } from '../artifact-read.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { isJsonRecord, } from '../json-guard.ts';
import type { EligibleEntries, } from './artifact-eligible.ts';
import { assertArtifactProvenance, } from './artifact-provenance.ts';
import {
  classifyBand,
  extractGradingCandidate,
  sourceBytesOf,
  type GradingCandidate,
  type SizeBand,
} from '../sample-grading.ts';
import { RUN_CORPUS_PIN, } from './run-config.ts';

//region Draw entry load
// Reading ONE settled artifact into the banded, candidate-bearing shape a draw
// samples from, and proving the bytes read are the entry the pool admitted.
//
// Split out of `draw-sample.ts` when that file reached its line cap. The draw
// itself is a sequence of decisions about a pool; this is the per-entry read
// those decisions rest on, and the two are separately reviewable.

/**
 * One settled entry: its parsed accepted issues and its size band.
 */
export type BandedEntry = {
  /**
   * Entry id.
   */
  readonly id: string;

  /**
   * Size band from the entry's zh source bytes.
   */
  readonly band: SizeBand;

  /**
   * Accepted issues flattened into grading candidates.
   */
  readonly candidates: readonly GradingCandidate[];
};

/**
 * One entry's share of a band, carried as a record rather than a formatted
 * string so the sort compares numbers instead of reparsing its own output.
 */
export type EntryContribution = {
  /**
   * Entry id.
   */
  readonly id: string;

  /**
   * Candidates this entry contributes to the band.
   */
  readonly count: number;
};

/**
 * Loads one artifact, reconciles its accepted count against the pipeline's own
 * tally, bands the entry, and flattens its accepted issues into candidates.
 *
 * @param artifactsDir - directory holding the artifact JSON files
 *
 * @param name - artifact file name
 *
 * @param eligible - resolved pool, whose recorded commit for this entry is
 * checked against the bytes actually read
 *
 * @returns The banded entry
 *
 * @throws {@link Error} when the parsed accepted count disagrees with the
 * artifact's recorded `acceptedCount`
 *
 * @throws ArtifactProvenanceError when the loaded bytes are not the entry the
 * pool admitted
 *
 * @example
 * ```ts
 * const entry = await loadEntry({ artifactsDir, name, eligible, },);
 * ```
 */
export async function loadEntry(
  {
    artifactsDir,
    name,
    eligible,
  }: {
    readonly artifactsDir: string;
    readonly name: string;
    readonly eligible: EligibleEntries;
  },
): Promise<BandedEntry> {
  /**
   * Raw artifact JSON, untyped until parsed.
   */
  const raw: unknown = JSON.parse(await readFile(
    join(
      artifactsDir,
      name,
    ),
    'utf8',
  ),);

  /**
   * Parsed accepted issues for this entry.
   */
  const parsed = parseSettledArtifact({ value: raw, },);

  /**
   * Entry id the pool keyed this file by, which is its file name.
   */
  const keyedId = name.slice(
    0,
    -'.json'.length,
  );

  /**
   * Commit the pool recorded for this file, absent when it placed no tip.
   */
  const expectedTip = eligible.tipByEntry
    .get(keyedId,);

  /**
   * Built pipeline the pool recorded for this file, absent when it placed none.
   */
  const expectedDigest = eligible.digestByEntry
    .get(keyedId,);

  // These BYTES, against what the pool said about this file. The pool keyed the
  // entry by file name and classified its generation from a separate read, so
  // until this check the draw could admit one artifact and sample another.
  //
  // The digest is the half that answers "same pipeline": checking only the tip
  // accepts a file rewritten by a different build under one commit, which is
  // precisely the substitution the generation census exists to catch.
  assertArtifactProvenance({
    name,
    observedId: parsed.id,
    observedTip: (isJsonRecord(raw,) && ((typeof raw.tip) === 'string'))
      ? raw.tip
      : '',
    observedDigest:
      (isJsonRecord(raw,) && ((typeof raw.pipelineDigest) === 'string'))
        ? raw.pipelineDigest
        : '',
    ...((expectedTip === undefined) ? {} : { expectedTip, }),
    ...((expectedDigest === undefined) ? {} : { expectedDigest, }),
  },);

  // The reconcile is REQUIRED, not opportunistic. It used to run only when
  // `acceptedCount` happened to be a number, which meant the one artifact shape
  // it could not check was the shape most likely to be wrong: a missing or
  // malformed field passed silently and its entry joined the pool unverified.
  // `corpus-pass.ts` writes this field on every artifact it produces, so an
  // artifact without it did not come from this pipeline, and this reader feeds
  // the precision gate where a short population is the exact harm.
  if (!isJsonRecord(raw,))
    throw new Error(
      `reconcile failed for ${parsed.id}: artifact is not an object, so the `
        + 'accepted count it recorded cannot be read and the pool would be '
        + 'built from an unverified entry.',
    );

  /**
   * The accepted count the pipeline recorded when it wrote the artifact.
   */
  const declaredAccepted = raw.acceptedCount;
  if ((typeof declaredAccepted) !== 'number')
    throw new Error(
      `reconcile failed for ${parsed.id}: artifact records no numeric `
        + `acceptedCount (found ${JSON.stringify(declaredAccepted,)}). Every `
        + 'artifact this pipeline writes carries one, so its absence means the '
        + 'file came from somewhere else and nothing can confirm the accepted '
        + 'population is complete.',
    );
  if (declaredAccepted
    !== parsed.acceptedIssues
    .length)
    throw new Error(
      `reconcile failed for ${parsed.id}: artifact acceptedCount `
        + `${String(declaredAccepted,)} != parsed ${
          String(parsed.acceptedIssues
            .length,)
        }; the accepted population would be silently short.`,
    );

  /**
   * The entry's zh source at the pinned corpus commit.
   */
  const source = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${parsed.id}/page.md`,
  },);

  /**
   * Size band from the source's UTF-8 byte length.
   */
  const band = classifyBand({ sourceBytes: sourceBytesOf({ text: source, },), },);

  return {
    id: parsed.id,
    band,
    candidates: parsed.acceptedIssues
      .map(function toCandidate(accepted,) {
        return extractGradingCandidate({
          issue: accepted.issue,
          entryId: parsed.id,
          band,
          ...(accepted.repair === undefined
            ? {}
            : { repair: accepted.repair, }),
        },);
      },),
  };
}


//endregion Draw entry load
