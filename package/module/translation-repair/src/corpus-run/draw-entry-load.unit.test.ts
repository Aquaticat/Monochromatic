/**
 * Tests for reading one settled artifact into the shape a draw samples from.
 *
 * THIS READER FEEDS THE PRECISION GATE, which is what makes its refusals worth
 * more than its happy path. Every issue it hands back becomes a row a human
 * grades, and the rate computed from those rows gets quoted as the pipeline's
 * precision. An entry that joins the pool unverified does not produce a wrong
 * number visibly; it produces a slightly short denominator, silently, and the
 * rate over it still looks like a measurement.
 *
 * SO THE CASES ARE ALL REFUSALS, and one of them is about ORDER. An artifact can
 * be both substituted and short at once, and which refusal comes out decides
 * what an operator goes looking for. Provenance is checked first on purpose: a
 * file that is not the entry the pool admitted has to be reported as the wrong
 * file, not as a file with the wrong number of issues in it.
 *
 * THE HAPPY PATH IS NOT HERE, and deliberately. `loadEntry` bands an entry by
 * reading its source at the pinned corpus commit, so a passing load needs the
 * unlicensed clone on disk; a unit suite that required it would pass on one
 * machine and fail everywhere else. Every guard below runs BEFORE that read, so
 * none of them needs it.
 *
 * FIXTURES ARE INVENTED AND CAT-THEMED, and every one is written into a
 * throwaway directory that is removed when the case ends.
 *
 * @module
 */

import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ArtifactProvenanceError,
  DrawReconcileError,
  type EligibleEntries,
  loadEntry,
} from '../../dist/final/node/index.mjs';

//region Draw entry load tests

/**
 * Entry these fixtures describe.
 */
const ENTRY_ID = 'whiskers';

/**
 * File that entry's artifact is written to.
 */
const ARTIFACT_NAME = `${ENTRY_ID}.json`;

/**
 * Commit the pool recorded for this entry.
 */
const POOL_TIP = 'c4f9e1a7b2d6';

/**
 * Built pipeline the pool recorded for this entry.
 */
const POOL_DIGEST = '8e3a0d5c17bf';

/**
 * A different commit, standing in for a file the pool never admitted.
 */
const OTHER_TIP = 'fa27b9046e3d';

/**
 * Builds one accepted issue record, in the shape the settled parser takes.
 *
 * @param issueId - identity of the adjudicated issue
 *
 * @returns Record shaped as an artifact carries one
 *
 * @example
 * ```ts
 * const record = acceptedRecord({ issueId: 'adjudicated/purr', },);
 * ```
 */
function acceptedRecord(
  { issueId, }: { readonly issueId: string; },
): unknown {
  return {
    sliceIndex: 0,
    resolved: false,
    issue: {
      issueId,
      status: 'accepted',
      severity: 'minor',
      claims: [
        {
          claimId: 'claim/whisker',
          claim: {
            category: 'accuracy/omission',
            severity: 'minor',
            summary: 'A purr is dropped from the greeting.',
            spans: [
              {
                side: 'source',
                nodeId: 'block/0',
                quotedText: 'the cat purred',
              },
              {
                side: 'target',
                nodeId: 'block/0',
                quotedText: '',
              },
            ],
          },
        },
      ],
      tallies: {},
    },
  };
}

/**
 * Builds the eligibility result the pool would hand this reader.
 *
 * @param tip - commit the pool recorded for this entry
 *
 * @returns Pool carrying that one entry
 *
 * @example
 * ```ts
 * const eligible = pooled({ tip: POOL_TIP, },);
 * ```
 */
function pooled(
  { tip, }: { readonly tip: string; },
): EligibleEntries {
  return {
    entryIds: [ENTRY_ID,],
    excludedIds: [],
    malformedIds: [],
    tipByEntry: new Map([[
      ENTRY_ID,
      tip,
    ],],),
    digestByEntry: new Map([[
      ENTRY_ID,
      POOL_DIGEST,
    ],],),
    selection: {
      kind: 'single-generation',
      digest: POOL_DIGEST,
    },
    report: [],
  };
}

/**
 * Opens a throwaway directory that removes itself on disposal.
 *
 * @returns Disposable directory handle
 *
 * @example
 * ```ts
 * await using scratch = await scratchDir();
 * ```
 */
async function scratchDir(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   * Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-draw-entry-',
  ),);

  return {
    path,
    [Symbol.asyncDispose]: async function removeScratch() {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Writes one artifact into a throwaway directory and reads it back.
 *
 * @param artifact - whole artifact value, valid or not
 *
 * @param eligible - pool to check the bytes against
 *
 * @returns What `loadEntry` made of it
 *
 * @throws Whatever `loadEntry` refuses with, which is the point of most cases
 *
 * @example
 * ```ts
 * await loadingFrom({ artifact, eligible: pooled({ tip: POOL_TIP, },), },);
 * ```
 */
async function loadingFrom(
  {
    artifact,
    eligible,
  }: {
    readonly artifact: unknown;
    readonly eligible: EligibleEntries;
  },
): Promise<unknown> {
  await using scratch = await scratchDir();

  await writeFile(
    join(
      scratch.path,
      ARTIFACT_NAME,
    ),
    JSON.stringify(artifact,),
    'utf8',
  );
  return await loadEntry({
    artifactsDir: scratch.path,
    name: ARTIFACT_NAME,
    eligible,
  },);
}

await describe({
  name: loadEntry.name,
  children: [
    it({
      name: 'REFUSES a file whose bytes are not the entry the pool admitted',
      fn: async () => {
        await expect(loadingFrom({
          artifact: {
            id: ENTRY_ID,
            tip: OTHER_TIP,
            pipelineDigest: POOL_DIGEST,
            corpusSha: 'sha/1',
            status: 'repaired',
            durationMs: 1,
            acceptedCount: 1,
            issues: [acceptedRecord({ issueId: 'adjudicated/purr', },),],
          },
          eligible: pooled({ tip: POOL_TIP, },),
        },),).rejects.toThrow(ArtifactProvenanceError,);
      },
    },),
    it({
      name: 'REFUSES an artifact recording no accepted count, since nothing can confirm the population',
      fn: async () => {
        await expect(loadingFrom({
          artifact: {
            id: ENTRY_ID,
            tip: POOL_TIP,
            pipelineDigest: POOL_DIGEST,
            corpusSha: 'sha/1',
            status: 'repaired',
            durationMs: 1,
            issues: [acceptedRecord({ issueId: 'adjudicated/purr', },),],
          },
          eligible: pooled({ tip: POOL_TIP, },),
        },),).rejects.toThrow('records no numeric acceptedCount',);
      },
    },),
    it({
      name: 'REFUSES a count recorded as something other than a number',
      fn: async () => {
        // The reconcile used to run only when the field happened to be a
        // number, so the one shape it could not check was the shape most likely
        // to be wrong.
        await expect(loadingFrom({
          artifact: {
            id: ENTRY_ID,
            tip: POOL_TIP,
            pipelineDigest: POOL_DIGEST,
            corpusSha: 'sha/1',
            status: 'repaired',
            durationMs: 1,
            acceptedCount: 'one',
            issues: [acceptedRecord({ issueId: 'adjudicated/purr', },),],
          },
          eligible: pooled({ tip: POOL_TIP, },),
        },),).rejects.toThrow('records no numeric acceptedCount',);
      },
    },),
    it({
      name: 'REFUSES a count that disagrees with what parsing found, naming both numbers',
      fn: async () => {
        await expect(loadingFrom({
          artifact: {
            id: ENTRY_ID,
            tip: POOL_TIP,
            pipelineDigest: POOL_DIGEST,
            corpusSha: 'sha/1',
            status: 'repaired',
            durationMs: 1,
            acceptedCount: 4,
            issues: [acceptedRecord({ issueId: 'adjudicated/purr', },),],
          },
          eligible: pooled({ tip: POOL_TIP, },),
        },),).rejects.toThrow('acceptedCount 4 != parsed 1',);
      },
    },),
    it({
      name: 'REFUSES as DrawReconcileError, a marked class, so the boundary prints the entry and both '
        + 'counts instead of the class name alone',
      fn: async () => {
        await expect(loadingFrom({
          artifact: {
            id: ENTRY_ID,
            tip: POOL_TIP,
            pipelineDigest: POOL_DIGEST,
            corpusSha: 'sha/1',
            status: 'repaired',
            durationMs: 1,
            acceptedCount: 4,
            issues: [acceptedRecord({ issueId: 'adjudicated/purr', },),],
          },
          eligible: pooled({ tip: POOL_TIP, },),
        },),).rejects.toThrow(DrawReconcileError,);
      },
    },),
    it({
      name: 'REPORTS a substituted file as substituted, not as one with the wrong count',
      fn: async () => {
        // Both wrong at once. Provenance runs first on purpose: an operator
        // told the count is short goes looking for missing issues, when the
        // file in front of them is not the entry they think it is.
        await expect(loadingFrom({
          artifact: {
            id: ENTRY_ID,
            tip: OTHER_TIP,
            pipelineDigest: POOL_DIGEST,
            corpusSha: 'sha/1',
            status: 'repaired',
            durationMs: 1,
            acceptedCount: 9,
            issues: [acceptedRecord({ issueId: 'adjudicated/purr', },),],
          },
          eligible: pooled({ tip: POOL_TIP, },),
        },),).rejects.toThrow(ArtifactProvenanceError,);
      },
    },),
  ],
},);

//endregion Draw entry load tests
