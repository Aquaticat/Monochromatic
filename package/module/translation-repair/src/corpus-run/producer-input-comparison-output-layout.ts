import {
  lstat,
  readdir,
  realpath,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { isDeepStrictEqual, } from 'node:util';
import { ProducerInputComparisonError, } from './producer-input-comparison-error.ts';
import { RUN_PREFIX, } from './producer-input-comparison-output-shape.ts';
import type { ProducerInputComparisonRun, } from './producer-input-comparison-storage.ts';

//region Private retained output layout before and after content observation

/**
 * Directory privacy includes special bits, not only group/other access.
 */
const DIRECTORY_MODE = 0o700n;
/**
 * Complete permission mask for BigInt filesystem observations.
 */
const MODE_MASK = 0o7777n;
/**
 * Verifies current private directory metadata without following a symlink leaf.
 *
 * @param path - fixed role inside the dedicated retained run
 *
 * @param run - independently captured comparison ownership
 *
 * @throws ProducerInputComparisonError when canonical identity, entry kind or permissions differ
 *
 * @example
 * ```ts
 * await comparisonOutputDirectory({ path, run });
 * ```
 */
async function comparisonOutputDirectory({
  path,
  run
}: {
  readonly path: string;
  readonly run: ProducerInputComparisonRun;
},): Promise<void> {
  /**
   * Point-in-time observations are not leases or creator authentication.
   */
  const state = await lstat(
    path,
    { bigint: true }
  );
  if ((!state.isDirectory()) || (state.uid !== BigInt(run.uid))
    || (state.gid !== BigInt(run.gid))
    || ((state.mode & MODE_MASK) !== DIRECTORY_MODE)
    || (await realpath(path) !== path))
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory: run.directory
    });
}

/**
 * Rechecks every fixed directory inventory before and after streamed artifact observation.
 *
 * @param inputRunDirectory - independently associated native run
 *
 * @param inputRunId - canonical observed namespace identity
 *
 * @param run - comparison ownership and dedicated native parent
 *
 * @throws ProducerInputComparisonError when directory privacy or a closed inventory differs
 *
 * @example
 * ```ts
 * await comparisonOutputLayout({ inputRunDirectory, inputRunId, run });
 * ```
 */
export async function comparisonOutputLayout({
  inputRunDirectory,
  inputRunId,
  run
}: {
  readonly inputRunDirectory: string;
  readonly inputRunId: string;
  readonly run: ProducerInputComparisonRun;
},): Promise<void> {
  /**
   * Output paths remain fixed independently of completion fields.
   */
  const output = join(
    inputRunDirectory,
    'output'
  );
  /**
   * Child home is an empty private role, not application cache storage.
   */
  const home = join(
    output,
    'home'
  );
  await Promise.all([
    inputRunDirectory,
    output,
    home
  ].map(async function verify(path): Promise<void> { await comparisonOutputDirectory({
    path,
    run
  }); }));
  if ((!isDeepStrictEqual(
    await readdir(run.inputParent),
    [`${RUN_PREFIX}${inputRunId}`]
  ))
    || (!isDeepStrictEqual(
      (await readdir(output)).toSorted(),
      [
        'complete.json',
        'home',
        'unqualified-inputs.json',
      ]
    ))
    || ((await readdir(home)).length > 0))
    throw new ProducerInputComparisonError({
      kind: 'output',
      directory: run.directory
    });
}

//endregion Private retained output layout before and after content observation
