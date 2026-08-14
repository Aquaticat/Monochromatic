import { createHash, } from 'node:crypto';
import {
  readdir,
  writeFile,
} from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import { readCorpusFile, } from '../corpus-source.ts';
import {
  locateSlice,
  type RelabelCase,
} from './probe-relabel-case.ts';
import { readArtifactRecords, } from './probe-relabel-artifact.ts';
import {
  formatVerifyManifest,
  formatVerifySheet,
  type VerifyItem,
} from './probe-verify-sheet.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_CORPUS_PIN,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';

//region Damage sample
// Draws shipped regions at random and asks a human the SAME source-anchored
// question the probe now asks, so the two answers are comparable.
//
// Every earlier repair measurement failed on one of two counts. The round-three
// repair sheet asked whether the returned wording fixed its issue, which is a
// different question from whether the edit damaged anything. The verification
// sheet asked the right question but drew only regions someone already believed
// were bad, and re-reading those five showed all five were correct repairs, so
// the selection carried the answer.
//
// This draws from every shipped region in the settled artifacts, by seed, with
// no reference to what anyone thought of them. The probe's verdict is recorded
// in the manifest and NEVER on the sheet: a reader shown a machine claim is
// answering a different question, and agreement measured that way is worthless.

/**
 * Regions drawn for one sheet.
 *
 * Twenty is a compromise between what a rate needs and what a person will read
 * carefully. Each item carries a full source passage, both texts, and a
 * judgement against the Chinese, so attention rather than count is the limit.
 */
const DAMAGE_SAMPLE_SIZE = 20;

/**
 * Identity domain for this draw, so its digests can never collide with the
 * detection draw's.
 */
const DAMAGE_DRAW_DOMAIN = 'damage-sample/v1';

/**
 * Separator between fields of a digest input.
 *
 * NUL because it cannot occur in a domain, seed, entry id or envelope id, so no
 * combination of those fields can reproduce another combination's digest input
 * and collide with it.
 *
 * Spelled as an escape rather than written as a literal byte. A raw NUL makes
 * git record the whole file as binary, so every diff of it reads
 * `Binary files differ` and every `rg` search skips it unless asked for
 * `--text`. Both were observed on this file before this constant existed.
 */
const FIELD_SEPARATOR = '\u0000';

/**
 * One shipped region, before its texts are rebuilt.
 */
type RegionRef = {
  /**
   * Corpus entry the region belongs to.
   */
  readonly entryId: string;

  /**
   * Envelope the edit replaced.
   */
  readonly envelopeId: string;

  /**
   * Replaced text, which also locates the slice.
   */
  readonly before: string;

  /**
   * Replacement text.
   */
  readonly editorAfter: string;

  /**
   * Accepted issues the region served.
   */
  readonly issueIds: readonly string[];
};

/**
 * Collects every distinct shipped region across the settled artifacts.
 *
 * @param dir - runs directory holding the artifacts
 *
 * @returns One reference per distinct region, entry order
 *
 * @example
 * ```ts
 * const regions = await collectShippedRegions({ dir, },);
 * ```
 */
async function collectShippedRegions(
  { dir, }: { readonly dir: string; },
): Promise<readonly RegionRef[]> {
  /**
   * Directory the settled artifacts sit in, named once so the listing, the
   * census and the later reads cannot drift onto different paths.
   */
  const artifactsDir = `${dir}/artifacts`;

  /**
   * One directory listing, shared with the census.
   *
   * Taken once and threaded through, because the accumulation writes into this
   * directory continuously: a second listing inside the census would classify a
   * different set of files from the one this reader goes on to read.
   */
  const listed = (await readdir(artifactsDir,))
    .filter(function isArtifact(name,) {
      return name.endsWith('.json',);
    },);

  /**
   * Artifact file names of the settled entries.
   */
  const files = keepEligible({
    names: listed,
    eligible: await resolvePool({
      artifactsDir,
      names: listed,
    },),
  },);

  /**
   * References gathered so far, keyed so one edit appears once.
   */
  const byKey = new Map<string, RegionRef>();
  /* oxlint-disable no-await-in-loop -- sequential on purpose: one artifact at a time keeps peak memory flat across 56 files */
  for (const file of files) {
    /**
     * Entry id, which is the artifact's own file name.
     */
    const entryId = file.slice(
      0,
      -'.json'.length,
    );

    /**
     * Settled records of this entry.
     */
    const records = await readArtifactRecords({ entryId, },);
    for (const record of records) {
      for (const region of record.repairRegions) {
        byKey.set(
          `${entryId} ${region.envelopeId}`,
          {
            entryId,
            envelopeId: region.envelopeId,
            before: region.before,
            editorAfter: region.editorAfter,
            issueIds: region.issueIds,
          },
        );
      }
    }
  }
  /* oxlint-enable no-await-in-loop */

  return [...byKey.values(),];
}

/**
 * One candidate region paired with the key its draw sorts on.
 *
 * Named rather than inferred, because an inferred object literal carries
 * writable properties and the comparator and unwrapping map that read it then
 * take mutable parameters they never mutate.
 */
type KeyedRegion = Readonly<{
  /**
   * Region that may be drawn.
   */
  region: RegionRef;

  /**
   * Seeded hash of the region's identity, the draw order.
   */
  key: string;
}>;

/**
 * Draws regions deterministically from the pool.
 *
 * Ordered by a digest of the seed and the region's identity, so the draw is
 * reproducible from the seed alone and independent of the order artifacts
 * happen to sit in on disk.
 *
 * @param regions - whole pool
 *
 * @param seed - draw seed
 *
 * @returns At most {@link DAMAGE_SAMPLE_SIZE} regions
 *
 * @example
 * ```ts
 * const drawn = drawRegions({ regions, seed: 'damage-round-one', },);
 * ```
 */
function drawRegions(
  {
    regions,
    seed,
  }: {
    readonly regions: readonly RegionRef[];
    readonly seed: string;
  },
): readonly RegionRef[] {
  return regions
    .map(function withKey(region,): KeyedRegion {
      return {
        region,
        key: createHash('sha256',)
          .update(
            [
              DAMAGE_DRAW_DOMAIN,
              seed,
              region.entryId,
              region.envelopeId,
            ].join(FIELD_SEPARATOR,),
          )
          .digest('hex',),
      };
    },)
    .toSorted(function byKey(
      left,
      right,
    ) {
      return left.key < right.key ? (-1) : 1;
    },)
    .slice(
      0,
      DAMAGE_SAMPLE_SIZE,
    )
    .map(function toRegion(entry,) {
      return entry.region;
    },);
}

/**
 * Rebuilds the slice texts around one drawn region.
 *
 * @param ref - drawn region
 *
 * @returns One case, or nothing when slicing cannot place the region
 *
 * @example
 * ```ts
 * const built = await buildCase({ ref, },);
 * ```
 */
async function buildCase(
  { ref, }: { readonly ref: RegionRef; },
): Promise<readonly RelabelCase[]> {
  /**
   * Original document at the pinned commit.
   */
  const sourceText = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${ref.entryId}/page.md`,
  },);

  /**
   * Translation at the same commit.
   */
  const targetText = await readCorpusFile({
    pin: RUN_CORPUS_PIN,
    relPath: `people/${ref.entryId}/page.en.md`,
  },);

  try {
    /**
     * Slice texts surrounding the region.
     */
    const slice = locateSlice({
      sourceText,
      targetText,
      before: ref.before,
    },);

    return [{
      entryId: ref.entryId,
      positions: [],
      region: {
        envelopeId: ref.envelopeId,
        issueIds: ref.issueIds,
        before: ref.before,
        editorAfter: ref.editorAfter,
      },
      issues: [],
      sourceText: slice.sourceText,
      baselineText: slice.baselineText,
      recorded: '',
    },];
  }
  catch (error) {
    // A region slicing can no longer place is dropped rather than fatal: the
    // draw is a sample, and one unplaceable region costs one item where a throw
    // would cost the sheet. The reason is logged so a systematic failure is
    // visible rather than showing up as a quietly short sheet.
    console.log(
      `DAMAGE skipped ${ref.entryId} ${ref.envelopeId}: ${String(error,)}`,
    );
    return [];
  }
}

/**
 * Draws a sample, probes each region, and writes the sheet and manifest.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Run artifact root for this checkout.
   */
  const dir = await resolveRunsDir();

  /**
   * Draw seed, overridable so a later round can draw a fresh sample.
   */
  const { DAMAGE_SAMPLE_SEED: configuredSeed, } = process.env;

  /**
   * Seed actually used, defaulted when nothing was exported.
   */
  const seed = configuredSeed ?? 'damage-round-one';

  /**
   * Every distinct shipped region in the settled artifacts.
   */
  const pool = await collectShippedRegions({ dir, },);
  console.log(
    `DAMAGE pool ${String(pool.length,)} distinct shipped regions, seed ${seed}`,
  );

  /**
   * Sheet items, one per drawn region that could be placed and probed.
   */
  const items: VerifyItem[] = [];
  /* oxlint-disable no-await-in-loop -- sequential by design so this never competes with a running corpus pass for per-model stream slots */
  for (const ref of drawRegions({
    regions: pool,
    seed,
  },)) {
    /**
     * Slice texts around this region.
     */
    const [built,] = await buildCase({ ref, },);
    if (built === undefined)
      continue;

    /**
     * What the probe says about it, issues withheld as production now runs.
     */
    const report = await runIntroducedDefectProbe({
      client: createRunClient(),
      proberModelIds: RUN_MODELS.checkerModelIds,
      sourceText: built.sourceText,
      baselineText: built.baselineText,
      regions: [built.region,],
      issues: [],
      signal: new AbortController().signal,
      perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
      l: tagged({ tag: 'damage-sample', },),
    },);

    /**
     * Screened tally of the single region.
     */
    const [tally,] = report.regions;

    items.push({
      relabelCase: built,
      claims: tally?.claims ?? [],
      // Labelled by what the PROBE said, not by anything a reader believes,
      // because on this sheet the probe's verdict is the thing under test and
      // the human grade is the truth it is scored against.
      kind: ((tally?.corroborated ?? 0) + (tally?.removalCorroborated ?? 0)) > 0
        ? 'probe-flagged'
        : 'probe-silent',
    },);
    console.log(
      `DAMAGE ${ref.entryId} ${ref.envelopeId} probe=${
        ((tally?.corroborated ?? 0) + (tally?.removalCorroborated ?? 0)) > 0
          ? 'flagged'
          : 'silent'
      }`,
    );
  }
  /* oxlint-enable no-await-in-loop */

  await writeFile(
    `${dir}/damage-sheet.md`,
    // Claims are stripped so the sheet shows the reader nothing the probe
    // concluded. The manifest keeps them for scoring.
    formatVerifySheet({
      items: items.map(function withoutClaims(item,) {
        return {
          ...item,
          claims: [],
        };
      },),
    },),
    'utf8',
  );
  await writeFile(
    `${dir}/damage-manifest.json`,
    formatVerifyManifest({ items, },),
    'utf8',
  );
  console.log(
    `DAMAGE wrote ${String(items.length,)} items to ${dir}/damage-sheet.md`,
  );
}

// Guarded so this runs only when INVOKED. Unguarded it ran on IMPORT, so
// anything pulling this module into the bundle performed the whole task as a
// side effect of loading the library: for the probing scripts that means live
// model calls, and for every one of them it means writing files.
if (import.meta.main)
  await main();

//endregion Damage sample
