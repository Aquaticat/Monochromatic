#!/usr/bin/env node

/**
 * Host orchestrator entrypoint and library surface for mutation testing.
 *
 * @example
 * ```bash
 * mutation-test --package packages/dev-script/file-enforcer src/io/glob-mirror.ts
 * ```
 */

import { pathToFileURL, } from 'node:url';

import { runCli, } from './host-runner.ts';

export { parseCliOptions, } from './cli-options.ts';
export {
  BAKED_ENTRYPOINT,
  REPORT_MOUNT,
  SELECTED_TESTS_ENV,
  SOURCE_MOUNT,
  WORK_MOUNT,
  buildContainerArgs,
  volumeMount,
} from './container-args.ts';
export {
  defaultWorkerCount,
  findRepoRoot,
  memoryBytes,
  reportNameForSource,
  resolveRequestedSources,
  runBounded,
} from './host-utils.ts';
export {
  runCli,
  runMutation,
} from './host-runner.ts';
export {
  INLINE_NU_SCRIPT,
  TEST_FILES_ENV,
  buildNuCommand,
  quotePosixShellToken,
} from './inline-nu.ts';
export {
  aggregateParsedReports,
  aggregateReports,
  addStatus,
  mutationScore,
  parseStatus,
} from './report.ts';
export {
  buildRuntimeImage,
  ensureRuntimeImage,
  imageExists,
  platformTag,
  runtimeImage,
  sha256Hex,
} from './runtime-image.ts';
export { enumerateSourceFiles, } from './source-selection.ts';
export { buildStrykerConfig, } from './stryker-config.ts';
export {
  selectTestsForSource,
  stemsAreRelated,
} from './test-selection.ts';
export type * from './types.ts';

/**
 * Whether this module is running as the process entrypoint.
 */
const isDirectEntrypoint = process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1],).href;

if (isDirectEntrypoint) {
  await runCli(process.argv.slice(2,),);
}
