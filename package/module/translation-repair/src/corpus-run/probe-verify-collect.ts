import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from '../chat-contract.ts';
import { wordForCount, } from '../count-word.ts';
import { runIntroducedDefectProbe, } from '../introduced-defect-probe.ts';
import {
  type ScreenedDefectClaim,
  UPHELD_ADMISSIBILITY,
} from '../introduced-defect-screen.ts';
import type { RelabelCase, } from './probe-relabel-case.ts';
import { singleRegionTally, } from './probe-single-tally.ts';
import type { VerifyItem, } from './probe-verify-sheet.ts';
import {
  RUN_MODELS,
  RUN_PER_CALL_TIMEOUT_MS,
} from './run-config.ts';

//region Probe verify collect
// Asks the unlabelled probe about each region and keeps the ones it flagged,
// as the items a human is later asked to grade.

/**
 Admissible claims, which are the only ones worth putting to a human.

 A contradicted claim is one the differential already refuted, and an
 unanchored one quotes nothing checkable. Asking about either would spend a
 reader's attention on a claim the deterministic screen has already settled.

 @param claims - screened claims of one region

 @returns Claims the screen corroborated

 @example
 ```ts
 const admissible = keepAdmissible({ claims, },);
 ```
 */
export function keepAdmissible(
  { claims, }: { readonly claims: readonly ScreenedDefectClaim[]; },
): readonly ScreenedDefectClaim[] {
  return claims
    .filter(function isAdmissible(claim,) {
      return UPHELD_ADMISSIBILITY.has(claim.admissibility,);
    },);
}

/**
 Probes one region with the accepted issues withheld.

 @param relabelCase - region and its surrounding texts

 @param client - client this one call asks through

 @returns Admissible claims raised, empty when the probe found nothing

 @example
 ```ts
 const claims = await probeWithheld({ relabelCase, client, },);
 ```
 */
async function probeWithheld(
  {
    relabelCase,
    client,
  }: {
    readonly relabelCase: RelabelCase;
    readonly client: SyntheticClient;
  },
): Promise<readonly ScreenedDefectClaim[]> {
  /**
   Report for this single region, with nothing labelled pre-existing.
   */
  const report = await runIntroducedDefectProbe({
    client,
    proberModelIds: RUN_MODELS.checkerModelIds,
    sourceText: relabelCase.sourceText,
    baselineText: relabelCase.baselineText,
    regions: [relabelCase.region,],
    issues: [],
    identityContext: '',
    signal: new AbortController().signal,
    perCallTimeoutMs: RUN_PER_CALL_TIMEOUT_MS,
    l: tagged({ tag: 'probe-verify', },),
  },);

  /**
   Screened tally of the single region.
   */
  const tally = singleRegionTally({ report, },);

  return keepAdmissible({ claims: tally.claims, },);
}

/**
 Probes every case and keeps the ones the probe flagged.

 @param cases - regions to probe

 @param kind - which set these came from, for the manifest

 @param newClient - builds the client each region is asked through: ONE FRESH
 CLIENT PER REGION, since a client reuses the reply to a prompt it has already
 been asked, and a region probed through a shared client could be answered from
 another region's reply

 @returns Sheet items, one per flagged region

 @example
 ```ts
 const items = await collectFlagged({ cases, kind: 'control', newClient, },);
 ```
 */
export async function collectFlagged(
  {
    cases,
    kind,
    newClient,
  }: {
    readonly cases: readonly RelabelCase[];
    readonly kind: 'damaged' | 'control';
    readonly newClient: () => SyntheticClient;
  },
): Promise<readonly VerifyItem[]> {
  /**
   Items gathered so far.
   */
  const items: VerifyItem[] = [];
  // Sequential so this never competes with a running corpus pass for the
  // per-model stream slots.
  /* oxlint-disable no-await-in-loop -- sequential by design, see comment */
  for (const relabelCase of cases) {
    /**
     Admissible claims on this region.
     */
    const claims = await probeWithheld({
      relabelCase,
      client: newClient(),
    },);
    console.log(
      `VERIFY ${kind} ${relabelCase.entryId} ${
        String(claims.length,)
      } admissible ${
        wordForCount({
          count: claims.length,
          one: 'claim',
          many: 'claims',
        },)
      }`,
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

//endregion Probe verify collect
