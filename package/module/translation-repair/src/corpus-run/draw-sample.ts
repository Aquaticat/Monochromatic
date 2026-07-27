import {
  readdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import { parseSettledArtifact, } from '../artifact-read.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import { formatGradingSheet, } from '../grading-sheet.ts';
import { isJsonRecord, } from '../json-guard.ts';
import { drawStratifiedSample, } from '../sample-draw.ts';
import {
  classifyBand,
  DEFAULT_PRECISION_BAR,
  DEFAULT_SAMPLE_SEED,
  DEFAULT_SAMPLE_SIZE,
  extractGradingCandidate,
  type GradingCandidate,
  SIZE_BANDS,
  type SizeBand,
} from '../sample-grading.ts';
import {
  RUN_CORPUS_PIN,
  resolveRunsDir,
} from './run-config.ts';
import { resolveSheetPath, } from './sheet-path.ts';

//region Draw sample
// Reads every settled artifact, bands each entry by its zh source bytes,
// flattens accepted issues into grading candidates, and draws the stratified
// precision sample into a grading sheet written OUTSIDE the repo (the sheet
// quotes UNLICENSED corpus text). Default run is PRELIMINARY validation over
// whatever has settled; pass `--final` once the large band fills to write the
// gate sheet. The reconcile below aborts loudly if a parsed accepted count
// disagrees with the artifact's own tally, so the sample is never silently
// short.

/**
 * One settled entry: its parsed accepted issues and its size band.
 */
type BandedEntry = {
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
 * Loads one artifact, reconciles its accepted count against the pipeline's own
 * tally, bands the entry, and flattens its accepted issues into candidates.
 *
 * @param artifactsDir - directory holding the artifact JSON files
 *
 * @param name - artifact file name
 *
 * @returns The banded entry
 *
 * @throws {@link Error} when the parsed accepted count disagrees with the
 * artifact's recorded `acceptedCount`
 */
async function loadEntry(
  {
    artifactsDir,
    name,
  }: {
    readonly artifactsDir: string;
    readonly name: string;
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

  if (isJsonRecord(raw,)) {
    /**
     * The accepted count the pipeline recorded when it wrote the artifact.
     */
    const declaredAccepted = raw.acceptedCount;
    if (((typeof declaredAccepted) === 'number')
      && (declaredAccepted
        !== parsed.acceptedIssues
        .length))
      throw new Error(
        `reconcile failed for ${parsed.id}: artifact acceptedCount `
          + `${String(declaredAccepted,)} != parsed ${
            String(parsed.acceptedIssues
              .length,)
          }; the accepted population would be silently short.`,
      );
  }

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
  const band = classifyBand({
    sourceBytes: new TextEncoder()
      .encode(source,)
      .length,
  },);

  return {
    id: parsed.id,
    band,
    candidates: parsed.acceptedIssues
      .map(function toCandidate(issue,) {
        return extractGradingCandidate({
          issue,
          entryId: parsed.id,
          band,
        },);
      },),
  };
}

/**
 * Draws the stratified precision sample and writes the grading sheet outside
 * the repo. Reads config and artifacts from the environment; `--final` writes
 * the gate sheet, otherwise a labelled preliminary sheet.
 *
 * @example
 * ```ts
 * await drawGradingSample();
 * ```
 */
async function drawGradingSample(): Promise<void> {
  /**
   * Whether this run writes the final gate sheet rather than a preliminary one.
   */
  const isFinal = process.argv
    .includes('--final',);

  /**
   * Durable, gitignored output root.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Per-entry artifact directory.
   */
  const artifactsDir = join(
    runsDir,
    'artifacts',
  );

  /**
   * Artifact file names present in the run.
   */
  const names = (await readdir(artifactsDir,))
    .filter(function isArtifact(name,) {
      return name.endsWith('.json',);
    },);

  /**
   * Every settled entry banded with its candidates.
   */
  const entries = await Promise.all(
    names.map(function load(name,) {
      return loadEntry({
        artifactsDir,
        name,
      },);
    },),
  );

  /**
   * The full accepted-issue pool across every entry.
   */
  const pool = entries.flatMap(function candidates(entry,) {
    return entry.candidates;
  },);

  for (const band of SIZE_BANDS) {
    /**
     * Entries whose size band is the current band.
     */
    const bandEntries = entries.filter(function inBand(entry,) {
      return entry.band === band;
    },);
    /**
     * Accepted issues those entries contribute to the pool.
     */
    const bandAccepted = bandEntries.reduce(
      function addCandidates(
        sum,
        entry,
      ) {
        return sum
          + entry.candidates
          .length;
      },
      0,
    );
    console.log(
      `POOL band=${band} entries=${String(bandEntries.length,)} accepted=${
        String(bandAccepted,)
      }`,
    );
  }

  /**
   * The drawn stratified sample.
   */
  const sample = drawStratifiedSample({
    candidates: pool,
    size: DEFAULT_SAMPLE_SIZE,
    seed: DEFAULT_SAMPLE_SEED,
  },);

  /**
   * Rendered grading sheet, with a preliminary banner unless this is final.
   */
  const sheet = `${
    isFinal
      ? ''
      : '> PRELIMINARY draw over whatever has settled so far; the large band is '
        + 'not yet filled, so this is for validating the sheet, NOT for final '
        + 'grading. The final draw shifts as the pool grows.\n\n'
  }${
    formatGradingSheet({
      sample,
      seed: DEFAULT_SAMPLE_SEED,
      bar: DEFAULT_PRECISION_BAR,
      corpusSha: RUN_CORPUS_PIN.commitSha,
    },)
  }`;

  /**
   * Output path, named after the draw seed so one round cannot target another
   * round's sheet, and refused outright when a final sheet is already there.
   */
  const outPath = await resolveSheetPath({
    runsDir,
    seed: DEFAULT_SAMPLE_SEED,
    isFinal,
  },);
  await writeFile(
    outPath,
    sheet,
  );

  console.log(
    `SAMPLE final=${String(isFinal,)} pool=${String(pool.length,)} drawn=${
      String(sample.length,)
    } out=${outPath}`,
  );
}

if (import.meta.main)
  await drawGradingSample();

//endregion Draw sample
