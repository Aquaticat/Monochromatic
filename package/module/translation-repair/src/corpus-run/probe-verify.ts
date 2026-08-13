import { writeFile, } from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import type { ScreenedDefectClaim, } from '../introduced-defect-screen.ts';
import {
  gatherRelabelCases,
  type RelabelCase,
} from './probe-relabel-case.ts';
import { gatherControlCases, } from './probe-relabel-control.ts';
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

//region Probe verify
// Runs the unlabelled probe over damaged and control regions alike, keeps every
// region it flags, and writes one blind sheet asking a human whether each flag
// is real.
//
// This is the measurement the relabel runs could not make. Withholding the
// accepted issues flags every damaged region and roughly four in ten unflagged
// ones, and nothing establishes what those four are, because unflagged only
// ever meant that nobody read them. A claim on a control region is either
// damage the reader never saw, which makes the probe a detector, or an
// invention, which caps its precision near half.
//
// Reads corpus text through git at the pinned commit. The sheet it writes
// quotes that text and lands outside the repository.

/**
 * Admissible claims, which are the only ones worth putting to a human.
 *
 * A contradicted claim is one the differential already refuted, and an
 * unanchored one quotes nothing checkable. Asking about either would spend a
 * reader's attention on a claim the deterministic screen has already settled.
 *
 * @param claims - screened claims of one region
 *
 * @returns Claims the screen corroborated
 *
 * @example
 * ```ts
 * const admissible = keepAdmissible({ claims, },);
 * ```
 */
function keepAdmissible(
  { claims, }: { readonly claims: readonly ScreenedDefectClaim[]; },
): readonly ScreenedDefectClaim[] {
  return claims
    .filter(function isAdmissible(claim,) {
      return (claim.admissibility === 'corroborated')
        || (claim.admissibility === 'removal-corroborated');
    },);
}

/**
 * Probes one region with the accepted issues withheld.
 *
 * @param relabelCase - region and its surrounding texts
 *
 * @returns Admissible claims raised, empty when the probe found nothing
 *
 * @example
 * ```ts
 * const claims = await probeWithheld({ relabelCase, },);
 * ```
 */
async function probeWithheld(
  { relabelCase, }: { readonly relabelCase: RelabelCase; },
): Promise<readonly ScreenedDefectClaim[]> {
  /**
   * Report for this single region, with nothing labelled pre-existing.
   */
  const report = await runIntroducedDefectProbe({
    client: createRunClient(),
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
    regions: [relabelCase.region,],
    issues: [],
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-verify', },),
  },);

  /**
   * Screened tally of the single region.
   */
  const [tally,] = report.regions;

  return keepAdmissible({ claims: tally?.claims ?? [], },);
}

/**
 * Probes every case and keeps the ones the probe flagged.
 *
 * @param cases - regions to probe
 *
 * @param kind - which set these came from, for the manifest
 *
 * @returns Sheet items, one per flagged region
 *
 * @example
 * ```ts
 * const items = await collectFlagged({ cases, kind: 'control', },);
 * ```
 */
async function collectFlagged(
  {
    cases,
    kind,
  }: {
    readonly cases: readonly RelabelCase[];
    readonly kind: 'damaged' | 'control';
  },
): Promise<readonly VerifyItem[]> {
  /**
   * Items gathered so far.
   */
  const items: VerifyItem[] = [];
  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const relabelCase of cases) {
    /**
     * Admissible claims on this region.
     */
    const claims = await probeWithheld({ relabelCase, },);
    console.log(
      `VERIFY ${kind} ${relabelCase.entryId} ${
        String(claims.length,)
      } admissible claims`,
    );
    if (claims.length === 0)
      continue;

    items.push({
      relabelCase,
      claims,
      kind,
    },);
  }
  /* oxlint-enable no-await-in-loop */

  return items;
}

/**
 * Builds the blind verification sheet and its scoring manifest.
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
   * Manifest the damaged positions index into.
   */
  const manifestPath =
    `${dir}/sample-manifest-milestone-three-precision-round-three.json`;

  /**
   * Regions a human read as damaged.
   */
  const damaged = await gatherRelabelCases({ manifestPath, },);

  /**
   * Regions from the same entries that nobody read.
   */
  const controls = await gatherControlCases({
    manifestPath,
    damaged,
  },);
  console.log(
    `VERIFY probing ${String(damaged.length,)} damaged and ${
      String(controls.length,)
    } control regions, issues withheld`,
  );

  /**
   * Flagged regions from both sets.
   */
  const items = [
    ...await collectFlagged({
      cases: damaged,
      kind: 'damaged',
    },),
    ...await collectFlagged({
      cases: controls,
      kind: 'control',
    },),
  ];

  await writeFile(
    `${dir}/probe-verify-sheet.md`,
    formatVerifySheet({ items, },),
    'utf8',
  );
  await writeFile(
    `${dir}/probe-verify-manifest.json`,
    formatVerifyManifest({ items, },),
    'utf8',
  );

  console.log(
    `VERIFY wrote ${String(items.length,)} items to ${dir}/probe-verify-sheet.md`,
  );
  console.log(
    'NOTE the sheet is blind and its manifest is not. Grade the sheet without '
      + 'opening the manifest, or the answer stops meaning anything.',
  );
}

await main();

//endregion Probe verify
