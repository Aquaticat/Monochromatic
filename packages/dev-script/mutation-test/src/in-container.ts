#!/usr/bin/env node

/**
 * Container-side entrypoint for one source-file Stryker session.
 *
 * @example
 * ```bash
 * node /baked/packages/dev-script/mutation-test/src/in-container.ts --package packages/dev-script/file-enforcer --mutate src/io/glob.ts --report /out/glob.json
 * ```
 */

import { join, } from 'node:path';
import { pathToFileURL, } from 'node:url';

import { WORK_MOUNT, } from './container-args.ts';
import { runPreflights, } from './container-preflight.ts';
import { runStryker, } from './container-stryker.ts';
import {
  recreateNodeModulesSymlinks,
  rsyncSourceToWorkTree,
} from './container-worktree.ts';
import {
  parseInContainerArgs,
  type InContainerOptions,
} from './in-container-options.ts';

export {
  parseBoolean,
  parseInContainerArgs,
} from './in-container-options.ts';
export {
  recreateNodeModulesSymlinks,
  rsyncSourceToWorkTree,
} from './container-worktree.ts';
export {
  inlineNuTwoFileSmoke,
  nativeTypeScriptSmoke,
  relativeImportSmoke,
  runPreflights,
  workspaceImportSmoke,
} from './container-preflight.ts';
export {
  readSelectedTests,
  runStryker,
} from './container-stryker.ts';
export type { InContainerOptions, } from './in-container-options.ts';

/**
 * Executes the full container-side mutation flow.
 *
 * @param options - Parsed entrypoint options.
 *
 * @example
 * ```ts
 * await runInContainer(parseInContainerArgs(process.argv.slice(2)));
 * ```
 */
export async function runInContainer(options: InContainerOptions,): Promise<void> {
  await rsyncSourceToWorkTree();
  await recreateNodeModulesSymlinks();
  /**
   * Target package working directory inside writable container work tree.
   */
  const packageCwd = join(
    WORK_MOUNT,
    options.packagePath,
  );
  await runPreflights(packageCwd,);
  await runStryker({
    options,
    packageCwd,
  },);
}

/**
 * Whether this module is running as the process entrypoint.
 */
const isDirectEntrypoint = (process.argv[1] !== undefined)
  && (import.meta.url
    === pathToFileURL(process.argv[1],)
    .href);

if (isDirectEntrypoint) {
  await runInContainer(
    parseInContainerArgs(process.argv
      .slice(2,),),
  );
}
