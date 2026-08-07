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
import { formatRepairSheet, } from '../repair-sheet.ts';
import { drawStratifiedSample, } from '../sample-draw.ts';
import { buildSampleManifest, } from '../sample-manifest.ts';
import {
  assertRepairMeasurable,
  classifyBand,
  countUnrecordedRepairs,
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
// whatever has settled; pass `--final` once every band has enough CONTRIBUTING
// entries to spread the draw, and only once the pass writing artifacts has
// stopped, since a live run can add one after the directory is read. Readiness
// is judged on contributing entries rather than accepted counts because the
// draw round-robins across entries. A preliminary run draws with a different
// seed on purpose, so repeated previews can never become a way of choosing the
// gate sample. The reconcile below aborts loudly if a parsed accepted count
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
 * One entry's share of a band, carried as a record rather than a formatted
 * string so the sort compares numbers instead of reparsing its own output.
 */
type EntryContribution = {
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
   * Seed the DRAW uses, which is deliberately NOT the gate seed on a
   * preliminary run.
   *
   * A preliminary draw exists to check that the sheets render and that the pool
   * reconciles, and it is run repeatedly while the pool grows. Drawing it with
   * the gate seed would make each one a preview of the gate sample over the
   * pool of the moment, and choosing when to finalize after seeing those
   * previews is selecting the sample on its contents. The file naming still
   * keys on {@link DEFAULT_SAMPLE_SEED} so one round cannot target another
   * round's path; only the shuffle differs.
   */
  const drawSeed = isFinal
    ? DEFAULT_SAMPLE_SEED
    : `${DEFAULT_SAMPLE_SEED}-preliminary`;

  /**
   * Write mode for this draw's outputs.
   *
   * Final outputs are created exclusively. `resolveSheetPath` already refuses a
   * path that exists, but that check and this write are separate steps, so two
   * draws racing each other can both see absence and both truncate. The whole
   * purpose of the refusal is that human grades exist nowhere else, which makes
   * the narrow race worth closing rather than reasoning about.
   */
  const writeFlag = isFinal
    ? 'wx'
    : 'w';

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
    /**
     * Entries actually contributing a candidate.
     *
     * An entry that settled `unchanged` accepts nothing, so it raises the entry
     * count while adding no candidate and no spread. Reading readiness off the
     * raw count would credit it for coverage it does not provide.
     */
    const contributing = bandEntries.filter(function hasCandidates(
      { candidates, },
    ) {
      return candidates.length > 0;
    },);
    /**
     * Per-entry candidate counts, heaviest first.
     *
     * Printed because the band totals hide how lopsided a band is: the draw
     * round-robins across entries, so a band's spread comes from how many
     * entries contribute, not from how many candidates they brought. Seeing the
     * shape here is what keeps that distinction from being guessed at.
     */
    const composition = contributing
      .map(function toCount(
        {
          id,
          candidates,
        },
      ): EntryContribution {
        return {
          id,
          count: candidates.length,
        };
      },)
      .toSorted(function byCountDescending(
        a: EntryContribution,
        b: EntryContribution,
      ) {
        return b.count - a.count;
      },)
      .map(function toLabel(
        {
          id,
          count,
        },
      ) {
        return `${id}:${String(count,)}`;
      },);
    console.log(
      `POOL band=${band} entries=${String(bandEntries.length,)} contributing=${
        String(contributing.length,)
      } accepted=${String(bandAccepted,)} perEntry=${composition.join(',',)}`,
    );
  }

  /**
   * The drawn stratified sample.
   */
  const sample = drawStratifiedSample({
    candidates: pool,
    size: DEFAULT_SAMPLE_SIZE,
    seed: drawSeed,
  },);

  /**
   * Sampled items carrying no recorded repair at all, which is what a draw over
   * pre-recording artifacts looks like.
   */
  const unrecorded = countUnrecordedRepairs({ sample, },);
  if (isFinal)
    assertRepairMeasurable({ sample, },);

  /**
   * Banner marking a scratch draw, prepended to BOTH sheets so neither can be
   * mistaken for the gate sheet on its contents alone.
   */
  const banner = isFinal
    ? ''
    : '> PRELIMINARY draw over whatever has settled so far, for validating the '
      + 'sheets and the pool, NOT for final grading. It is drawn with a '
      + 'different seed from the gate sheet, so these are deliberately not the '
      + 'items the gate will draw, and the final draw shifts again as the pool '
      + 'grows.\n\n';

  // Both paths resolve BEFORE either file is written. Writing the detection
  // sheet first would leave it in place, and protected against overwrite, when
  // the repair path turns out to be refused.
  /**
   * Output path, named after the draw seed so one round cannot target another
   * round's sheet, and refused outright when a final sheet is already there.
   */
  const outPath = await resolveSheetPath({
    runsDir,
    seed: DEFAULT_SAMPLE_SEED,
    isFinal,
  },);

  /**
   * Companion repair sheet path. The repair sheet is its own file rather than
   * extra boxes on the detection sheet: a visible correction makes an alleged
   * defect look more real, so folding the two together would change what the
   * detection number measures and break comparison with the rounds already
   * graded.
   */
  const repairPath = await resolveSheetPath({
    runsDir,
    seed: DEFAULT_SAMPLE_SEED,
    isFinal,
    kind: 'repair',
  },);

  /**
   * Companion manifest path.
   *
   * Resolved with the sheets and BEFORE any write, never after. Every one of
   * these throws when a final file already exists, which is the protection
   * against overwriting graded work, and a path resolved after a write turns
   * that protection into damage: the sheets would be replaced and the run would
   * then abort, leaving a graded set half rewritten.
   */
  const manifestPath = await resolveSheetPath({
    runsDir,
    seed: DEFAULT_SAMPLE_SEED,
    isFinal,
    kind: 'manifest',
  },);

  await writeFile(
    outPath,
    `${banner}${
      formatGradingSheet({
        sample,
        seed: drawSeed,
        bar: DEFAULT_PRECISION_BAR,
        corpusSha: RUN_CORPUS_PIN.commitSha,
      },)
    }`,
    { flag: writeFlag, },
  );
  await writeFile(
    repairPath,
    `${banner}${
      formatRepairSheet({
        sample,
        seed: drawSeed,
        corpusSha: RUN_CORPUS_PIN.commitSha,
      },)
    }`,
    { flag: writeFlag, },
  );

  // Written in the same breath as the sheets, because this is the only instant
  // the mapping exists. The sheets print no issue id, and re-running the draw
  // does not recover one: the draw is deterministic in its seed but not in its
  // POOL, which grows with every entry that settles. Without this file no human
  // grade can ever be joined to a machine verdict about the same item.
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      buildSampleManifest({
        sample,
        seed: drawSeed,
        corpusSha: RUN_CORPUS_PIN.commitSha,
      },),
      undefined,
      2,
    )}\n`,
    { flag: writeFlag, },
  );

  console.log(
    `SAMPLE final=${String(isFinal,)} seed=${drawSeed} pool=${
      String(pool.length,)
    } drawn=${String(sample.length,)} unrecordedRepairs=${
      String(unrecorded,)
    } out=${outPath} repairOut=${repairPath} manifest=${manifestPath}`,
  );
}

if (import.meta.main)
  await drawGradingSample();

//endregion Draw sample
