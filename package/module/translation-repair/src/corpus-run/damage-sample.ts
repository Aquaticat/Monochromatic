import { createHash, } from 'node:crypto';
import {
  writeFile,
} from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import type { RelabelCase, } from './probe-relabel-case.ts';
import {
  collectShippedRegionsV2,
  type ShippedRegionV2,
} from './damage-region-v2.ts';
import {
  formatVerifyManifest,
  formatVerifySheet,
  type VerifyItem,
} from './probe-verify-sheet.ts';
import {
  createRunClient,
  resolveRunsDir,
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';
import {
  keepEligible,
  resolvePool,
} from './artifact-pool.ts';
import { readdirArtifacts, } from './artifact-placement.ts';

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
 *
 * BUMPED WITH THE POPULATION. Version 1 drew envelopes out of a top-level issue
 * list; this draws slices out of both lanes' delivery ledgers. The two are
 * different populations addressed by different identities, so sharing a domain
 * would let a version 1 sheet and a version 2 sheet claim the same draw.
 */
const DAMAGE_DRAW_DOMAIN = 'damage-sample/v2';

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
 * Collects every shipped region across the settled artifacts.
 *
 * THE LISTING STAYS HERE and the reading moves out, because eligibility is a
 * question about the POOL while shipping is a question about one artifact's
 * ledger, and mixing them is what let the old reader describe a repair-lane-only
 * population as the shipped regions.
 *
 * @param dir - runs directory holding the artifacts
 *
 * @returns Regions the damage question can be asked about, and how many rows
 * filled a passage that had no incumbent wording
 *
 * @example
 * ```ts
 * const { regions, } = await collectShippedRegions({ dir, },);
 * ```
 */
async function collectShippedRegions(
  { dir, }: { readonly dir: string; },
): Promise<Awaited<ReturnType<typeof collectShippedRegionsV2>>> {
  /**
   * Directory the settled artifacts sit in, named once so the listing, the
   * census and the later reads cannot drift onto different paths.
   */
  const artifactsDir = `${dir}/artifacts`;

  /**
   * One directory listing, shared with the census.
   *
   * Taken once and threaded through, because a pass writes into this directory
   * continuously: a second listing inside the census would classify a different
   * set of files from the one this reader goes on to read.
   */
  const listed = (await readdirArtifacts({ artifactsDir, },))
    .filter(function isArtifact(name,) {
      return name.endsWith('.json',);
    },);

  return await collectShippedRegionsV2({
    artifactsDir,
    files: keepEligible({
      names: listed,
      eligible: await resolvePool({
        artifactsDir,
        names: listed,
      },),
    },),
  },);
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
  region: ShippedRegionV2;

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
    readonly regions: readonly ShippedRegionV2[];
    readonly seed: string;
  },
): readonly ShippedRegionV2[] {
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
              region.regionId,
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
 * Turns one drawn region into the case a sheet item is built from.
 *
 * NO CORPUS READ AND NO RE-SLICING, unlike the version 1 path. The delivery row
 * already carries the original passage and the wording that was there before, as
 * the judges saw them, and `#115` settled that re-sliced text is a different
 * input from the one that was judged. That also removes a failure mode rather
 * than moving it: the old builder could draw a region and then fail to place it
 * again, quietly shortening the sheet.
 *
 * THE WHOLE SLICE IS THE REGION here, because version 2 delivers by slice rather
 * than by envelope, so the wording that was there before and the baseline the
 * probe reads are the same text.
 *
 * @param ref - drawn region
 *
 * @returns One case
 *
 * @example
 * ```ts
 * const built = buildCase({ ref, },);
 * ```
 */
function buildCase(
  { ref, }: { readonly ref: ShippedRegionV2; },
): RelabelCase {
  return {
    entryId: ref.entryId,
    positions: [],
    region: {
      envelopeId: ref.regionId,
      issueIds: [],
      before: ref.incumbentText,
      editorAfter: ref.shippedText,
    },
    issues: [],
    sourceText: ref.sourceText,
    baselineText: ref.incumbentText,
    recorded: '',
  };
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
  const {
    regions: pool,
    filledWithoutIncumbent,
  } = await collectShippedRegions({ dir, },);
  console.log(
    `DAMAGE pool ${String(pool.length,)} shipped regions across both lanes, seed ${seed}`,
  );
  // Reported rather than dropped: a slice filled where the archive had no
  // English replaced nothing, so no edit could have damaged anything there, and
  // the honest question about it belongs on a different sheet.
  console.log(
    `DAMAGE ${String(filledWithoutIncumbent,)} shipped rows had no incumbent wording and are not drawn from`,
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
     * Case this region makes.
     */
    const built = buildCase({ ref, },);

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
      `DAMAGE ${ref.entryId} ${ref.regionId} probe=${
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
