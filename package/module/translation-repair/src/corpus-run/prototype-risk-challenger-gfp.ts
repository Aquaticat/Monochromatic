// PROTOTYPE ONLY: Candidate M guard-failure proof runner.

import { createHash, } from 'node:crypto';
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { resolve, } from 'node:path';

import {
  assertCandidateMGfpFilesystemInventory,
  createCandidateMGfpFixture,
} from './prototype-risk-challenger-gfp-worktree.ts';
import {
  CANDIDATE_M_GFP_MUTATIONS,
  type CandidateMGfpMutation,
} from './prototype-risk-challenger-gfp-mutations.ts';
import {
  candidateMGfpCompletedNormally,
  candidateMGfpDetectionPhase,
  type CandidateMGfpGate,
  runCandidateMGfpGate,
} from './prototype-risk-challenger-gfp-process.ts';

/**
 * Restrictive file-creation mask for disposable fixtures.
 */
const PRIVATE_UMASK = 0o077;
/**
 * Prototype repository root derived from package-scoped mise working directory.
 */
const REPOSITORY_ROOT = resolve(
  process.cwd(),
  '../../..',
);
/**
 * Every repository-relative source path defining this reproducible harness.
 */
const HARNESS_RELATIVE_PATHS = [
  'package/module/translation-repair/mise.toml',
  'package/module/translation-repair/src/corpus-run/prototype-risk-challenger-gfp.ts',
  'package/module/translation-repair/src/corpus-run/prototype-risk-challenger-gfp-worktree.ts',
  'package/module/translation-repair/src/corpus-run/prototype-risk-challenger-gfp-mutations.ts',
  'package/module/translation-repair/src/corpus-run/prototype-risk-challenger-gfp-process.ts',
] as const;

/**
 * One mutation's exact gate result.
 *
 * @example
 * ```ts
 * const result: CandidateMGfpMutationResult = { name: 'fixture', detectedBy: 'none', ...gate, };
 * ```
 */
type CandidateMGfpMutationResult = CandidateMGfpGate & {
  /**
   * Stable mutation evidence name.
   */
  readonly name: string;
  /**
   * Exact successful detection phase or explicit absence.
   */
  readonly detectedBy: 'build' | 'targeted-test' | 'none';
};

/**
 * Durable privacy-safe Candidate M GFP output.
 *
 * @example
 * ```ts
 * const summary: CandidateMGfpSummary = { harnessSha256, mutations, restoredBaseline, };
 * ```
 */
type CandidateMGfpSummary = {
  /**
   * SHA-256 over every harness source path and exact content.
   */
  readonly harnessSha256: string;
  /**
   * One gate result per static mutation.
   */
  readonly mutations: readonly CandidateMGfpMutationResult[];
  /**
   * Fresh detached-worktree baseline after all mutation fixtures.
   */
  readonly restoredBaseline: CandidateMGfpGate;
};

/**
 * Hashes every harness source path and exact content.
 *
 * @returns Stable source-set SHA-256
 */
async function harnessDigest(): Promise<string> {
  /**
   * Exact path and content pairs for source-set identity.
   */
  const entries = await Promise.all(HARNESS_RELATIVE_PATHS.map(async function readHarness(relativePath,) {
    return {
      relativePath,
      content: await readFile(
        resolve(
          REPOSITORY_ROOT,
          relativePath,
        ),
        'utf8',
      ),
    };
  },),);
  return createHash('sha256',)
    .update(JSON.stringify(entries,),)
    .digest('hex',);
}

/**
 * Requires one synthetic unexpected-path inventory to reject.
 *
 * @param ordinaryText - NUL-delimited ordinary untracked paths
 *
 * @param ignoredText - NUL-delimited ignored paths
 */
function expectInventoryRejection({
  ordinaryText,
  ignoredText,
}: {
  readonly ordinaryText: string;
  readonly ignoredText: string;
}): void {
  try {
    assertCandidateMGfpFilesystemInventory({
      ordinaryText,
      ignoredText,
    },);
  }
  catch (error) {
    if (Error.isError(error,))
      return;
    throw error;
  }
  throw new Error('Candidate M GFP filesystem inventory control was accepted');
}

/**
 * Proves empty inventory acceptance and exact unexpected-path refusal.
 */
function proveInventoryControls(): void {
  assertCandidateMGfpFilesystemInventory({
    ordinaryText: '',
    ignoredText: '',
  },);
  expectInventoryRejection({
    ordinaryText: 'mise.local.toml\0',
    ignoredText: '',
  },);
  expectInventoryRejection({
    ordinaryText: '',
    ignoredText: '.mise.toml\0',
  },);
  expectInventoryRejection({
    ordinaryText: '',
    ignoredText: '.mise/tasks/example\0',
  },);
  expectInventoryRejection({
    ordinaryText: 'mise.lock\0',
    ignoredText: '',
  },);
  expectInventoryRejection({
    ordinaryText: 'unusual\npath\0',
    ignoredText: '',
  },);
  expectInventoryRejection({
    ordinaryText: 'unterminated',
    ignoredText: '',
  },);
}

/**
 * Applies one mutation only inside fresh detached disposable worktree.
 *
 * @param mutation - Exact source replacement under test
 *
 * @returns Normal, failed, or interrupted rebuild and targeted-test outcomes
 */
async function runMutation(
  mutation: CandidateMGfpMutation,
): Promise<CandidateMGfpMutationResult> {
  /**
   * Disposable worktree containing only current mutation.
   */
  await using fixture = await createCandidateMGfpFixture();
  /**
   * Exact source path inside disposable worktree.
   */
  const path = resolve(
    fixture.root,
    mutation.relativePath,
  );
  /**
   * Unmutated source removed by disposing entire worktree.
   */
  const original = await readFile(
    path,
    'utf8',
  );
  if (original.split(mutation.oldText,)
    .length
    !== 2)
    throw new Error(`Candidate M mutation anchor differs: ${mutation.name}`);
  await writeFile(
    path,
    original.replace(
      mutation.oldText,
      mutation.newText,
    ),
    'utf8',
  );
  /**
   * Rebuild and targeted-test evidence for current mutation.
   */
  const gate = await runCandidateMGfpGate(fixture.root,);
  return {
    name: mutation.name,
    detectedBy: candidateMGfpDetectionPhase(gate,),
    ...gate,
  };
}

/**
 * Runs fresh baseline in separate detached disposable worktree.
 *
 * @returns Unmutated rebuild and targeted-test outcomes
 */
async function runBaseline(): Promise<CandidateMGfpGate> {
  /**
   * Fresh disposable worktree without mutation.
   */
  await using fixture = await createCandidateMGfpFixture();
  return await runCandidateMGfpGate(fixture.root,);
}

/**
 * Runs every mutation serially and emits privacy-safe summary.
 *
 * @throws Error when interruption or missing detection invalidates evidence
 */
async function main(): Promise<void> {
  process.umask(PRIVATE_UMASK,);
  proveInventoryControls();
  /**
   * Serial mutation evidence avoids concurrent builds sharing dependency links.
   */
  const mutations = await Array.fromAsync(
    CANDIDATE_M_GFP_MUTATIONS,
    runMutation,
  );
  /**
   * Fresh unmutated rebuild and targeted-test evidence.
   */
  const restoredBaseline = await runBaseline();
  /**
   * Privacy-safe source and gate summary.
   */
  const summary: CandidateMGfpSummary = {
    harnessSha256: await harnessDigest(),
    mutations,
    restoredBaseline,
  };
  console.log(JSON.stringify(summary,),);
  if ((!candidateMGfpCompletedNormally(restoredBaseline.build,))
    || (restoredBaseline.build
      .status
      !== 0)
    || (restoredBaseline.test === undefined)
    || (!candidateMGfpCompletedNormally(restoredBaseline.test,))
    || (restoredBaseline.test
      .status
      !== 0)
    || mutations.some(function undetected(result,) { return result.detectedBy === 'none'; }))
    throw new Error('Candidate M GFP gate did not detect every mutation');
}

await main();
