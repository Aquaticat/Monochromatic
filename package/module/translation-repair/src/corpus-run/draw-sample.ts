import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { formatGradingSheet, } from '../grading-sheet.ts';
import { formatRepairSheet, } from '../repair-sheet.ts';
import { drawStratifiedSample, } from '../sample-draw.ts';
import { buildSampleManifest, } from '../sample-manifest.ts';
import {
  assertRepairMeasurable,
  countUnrecordedRepairs,
  DEFAULT_PRECISION_BAR,
  DEFAULT_SAMPLE_SEED,
  DEFAULT_SAMPLE_SIZE,
  SIZE_BANDS,
} from '../sample-grading.ts';
import { trackDrawOutputs, } from './draw-outputs.ts';
import {
  RUN_CORPUS_PIN,
  resolveRunsDir,
} from './run-config.ts';
import { resolveSheetPath, } from './sheet-path.ts';
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';
import { readdirArtifacts, } from './artifact-placement.ts';
import {
  type EntryContribution,
  loadEntry,
} from './draw-entry-load.ts';

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
   * One directory listing, shared with the census.
   *
   * Taken once and threaded through, because the accumulation writes into this
   * directory continuously: a second listing inside the census would classify a
   * different set of files from the one this draw goes on to read, so an
   * artifact arriving between the two would join the census while never
   * entering the candidate pool.
   */
  const listed = (await readdirArtifacts({ artifactsDir, },))
    .filter(function isArtifact(name,) {
      return name.endsWith('.json',);
    },)
    // Sorted so the pool is built in one fixed order. The draw itself sorts by
    // keys derived from the seed and the ids, so it does not depend on this,
    // but the POOL report and any error naming "the first bad artifact" do, and
    // a report that changes with directory order is a report nobody can cite.
    .toSorted();

  /**
   * Entries this draw may pool, with the commit each recorded.
   */
  const eligible = await resolvePool({
    artifactsDir,
    names: listed,
  },);

  /**
   * Artifact file names present in the run.
   */
  const names = keepEligible({
    names: listed,
    eligible,
  },);

  /**
   * Every settled entry banded with its candidates.
   */
  const entries = await Promise.all(
    names.map(function load(name,) {
      return loadEntry({
        artifactsDir,
        name,
        eligible,
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

  /**
   * Pool-wide candidates carrying no recorded repair.
   *
   * Reported because {@link assertRepairMeasurable} only inspects what was
   * DRAWN, so pre-recording candidates left in the pool escape it whenever the
   * seed happens not to select them. Seeing the pool figure says whether a
   * clean sample means a clean pool or a lucky draw, and it is the number that
   * predicts whether the final draw will abort.
   */
  const unrecordedPool = countUnrecordedRepairs({ sample: pool, },);
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
      + 'different seed from the gate sheet, so it is not a preview of the gate '
      + 'draw; individual items can still coincide, since a different seed '
      + 'reorders the pool rather than excluding anything from it. The final '
      + 'draw shifts again as the pool grows.\n\n';

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

  /**
   * Files this invocation creates, removed on the way out unless all three
   * land.
   */
  await using outputs = trackDrawOutputs({ enabled: isFinal, },);

  // Built BEFORE either sheet, so one object is the source of the digest all
  // three files carry. Computing it twice would let the sheets and the manifest
  // disagree about the very thing that exists to prove they agree.
  /**
   * What sat at each sheet position, and the fingerprint of this exact draw.
   */
  const manifest = buildSampleManifest({
    sample,
    seed: drawSeed,
    corpusSha: RUN_CORPUS_PIN.commitSha,
  },);

  /**
   * Draw fingerprint printed into both sheet headers.
   *
   * Non-null because `buildSampleManifest` always computes one; the field is
   * optional only so manifests written before the binding can still be read.
   */
  const drawDigest = nonNullishOrThrow(manifest.drawDigest,);

  // Recorded BEFORE each write, since a write can create the file and then
  // fail, and a path recorded only on success would leave that file behind.
  outputs.record({ path: outPath, },);
  await writeFile(
    outPath,
    `${banner}${
      formatGradingSheet({
        sample,
        seed: drawSeed,
        bar: DEFAULT_PRECISION_BAR,
        corpusSha: RUN_CORPUS_PIN.commitSha,
        drawDigest,
      },)
    }`,
    { flag: writeFlag, },
  );
  outputs.record({ path: repairPath, },);
  await writeFile(
    repairPath,
    `${banner}${
      formatRepairSheet({
        sample,
        seed: drawSeed,
        corpusSha: RUN_CORPUS_PIN.commitSha,
        drawDigest,
      },)
    }`,
    { flag: writeFlag, },
  );

  // Written in the same breath as the sheets, because this is the only instant
  // the mapping exists. The sheets print no issue id, and re-running the draw
  // does not recover one: the draw is deterministic in its seed but not in its
  // POOL, which grows with every entry that settles. Without this file no human
  // grade can ever be joined to a machine verdict about the same item.
  outputs.record({ path: manifestPath, },);
  await writeFile(
    manifestPath,
    `${JSON.stringify(
      manifest,
      undefined,
      2,
    )}\n`,
    { flag: writeFlag, },
  );

  // Every output landed, so the set is the complete record of one draw and
  // nothing is removed on the way out.
  outputs.commit();

  console.log(
    `SAMPLE final=${String(isFinal,)} seed=${drawSeed} pool=${
      String(pool.length,)
    } drawn=${String(sample.length,)} unrecordedRepairs=${
      String(unrecorded,)
    } unrecordedInPool=${String(unrecordedPool,)} out=${outPath} repairOut=${
      repairPath
    } manifest=${manifestPath}`,
  );
}

if (import.meta.main)
  await drawGradingSample();

//endregion Draw sample
