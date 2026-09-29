import { join, } from 'node:path';


import { readRunJson, } from '../run-json-read.ts';
import { parseSettledArtifact, } from '../artifact-read.ts';
import { requireRecord, } from '../artifact-guard.ts';
import type { readCorpusFile, } from '../corpus-source.ts';
import { DrawReconcileError, } from './draw-reconcile.ts';
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
 One settled entry: its parsed accepted issues and its size band.
 */
export type BandedEntry = {
  /**
   Entry id.
   */
  readonly id: string;

  /**
   Size band from the entry's zh source bytes.
   */
  readonly band: SizeBand;

  /**
   Accepted issues flattened into grading candidates.
   */
  readonly candidates: readonly GradingCandidate[];
};

/**
 One entry's share of a band, carried as a record rather than a formatted
 string so the sort compares numbers instead of reparsing its own output.
 */
export type EntryContribution = {
  /**
   Entry id.
   */
  readonly id: string;

  /**
   Candidates this entry contributes to the band.
   */
  readonly count: number;
};

/**
 Loads one artifact, reconciles its accepted count against the pipeline's own
 tally, bands the entry, and flattens its accepted issues into candidates.
 
 @param artifactsDir - directory holding the artifact JSON files
 
 @param name - artifact file name
 
 @param eligible - resolved pool, whose recorded commit for this entry is
 checked against the bytes actually read

 @param readSource - reads a corpus file at a pin: `readCorpusFile` in a run,
 a fixture in a test, since the clone is unlicensed and absent elsewhere.
 REQUIRED: a default read the clone for any caller that left it out
 (ledger M43, X24)

 @returns The banded entry

 @throws DrawReconcileError when the artifact records no numeric
 `acceptedCount`, or one the parsed accepted issues disagree with

 @throws ArtifactProvenanceError when the loaded bytes are not the entry the
 pool admitted

 @example
 ```ts
 const entry = await loadEntry({ artifactsDir, name, eligible, readSource: readCorpusFile, },);
 ```
 */
export async function loadEntry(
  {
    artifactsDir,
    name,
    eligible,
    readSource,
  }: {
    readonly artifactsDir: string;
    readonly name: string;
    readonly eligible: EligibleEntries;
    readonly readSource: typeof readCorpusFile;
  },
): Promise<BandedEntry> {
  /**
   Raw artifact JSON, untyped until parsed.
   */
  const raw: unknown = await readRunJson({
    path: join(
      artifactsDir,
      name,
    ),
  },);

  /**
   Parsed accepted issues for this entry.
   */
  const parsed = parseSettledArtifact({ value: raw, },);

  /**
   The artifact as a record, which parsing just proved it is, for the fields
   the parser does not read. A reconcile fault for a file that is not an
   object stood here and could not fire after the parse (ledger T8).
   */
  const artifact = requireRecord({
    value: raw,
    path: 'artifact',
  },);

  /**
   Entry id the pool keyed this file by, which is its file name.
   */
  const keyedId = name.slice(
    0,
    -'.json'.length,
  );

  /**
   Commit the pool recorded for this file, absent when it placed no tip.
   */
  const expectedTip = eligible.tipByEntry
    .get(keyedId,);

  /**
   Built pipeline the pool recorded for this file, absent when it placed none.
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
    observedTip: ((typeof artifact.tip) === 'string')
      ? artifact.tip
      : '',
    observedDigest: ((typeof artifact.pipelineDigest) === 'string')
      ? artifact.pipelineDigest
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
  /**
   The accepted count the pipeline recorded when it wrote the artifact.
   */
  const declaredAccepted = artifact.acceptedCount;
  if ((typeof declaredAccepted) !== 'number')
    throw new DrawReconcileError({
      entryId: parsed.id,
      fault: {
        kind: 'no-numeric-count',
        foundType: typeof declaredAccepted,
      },
    },);
  if (declaredAccepted
    !== parsed.acceptedIssues
    .length)
    throw new DrawReconcileError({
      entryId: parsed.id,
      fault: {
        kind: 'count-disagrees',
        declared: declaredAccepted,
        parsed: parsed.acceptedIssues
          .length,
      },
    },);

  /**
   The entry's zh source at the pinned corpus commit.
   */
  const source = await readSource({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${parsed.id}/page.md`,
  },);

  /**
   Size band from the source's UTF-8 byte length.
   */
  const band = classifyBand({ sourceBytes: sourceBytesOf({ text: source, },), },);

  return {
    id: parsed.id,
    band,
    candidates: parsed.acceptedIssues
      .map(function toCandidate(accepted,) {
        /**
         What the artifact recorded about this issue's repair, which is a
         named absence on an artifact written before repair recording.
         */
        const reading = accepted.repair;

        return extractGradingCandidate({
          issue: accepted.issue,
          entryId: parsed.id,
          band,

          // THE ONE PLACE the named absence becomes an absent field, and it
          // stays here because this is where a candidate is built for the
          // SAMPLE FILE. That file's shape is on disk in draws a human is
          // grading, so widening it is a change to a persisted format rather
          // than to a reader, and it belongs to whoever decides to make it.
          ...(reading.kind === 'unrecorded'
            ? {}
            : { repair: reading.repair, }),
        },);
      },),
  };
}


//endregion Draw entry load
