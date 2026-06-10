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
  INLINE_NODE_SCRIPT,
  TEST_FILES_ENV,
  buildNodeCommand,
  quotePosixShellToken,
} from './inline-node.ts';
export {
  MUTATION_TSCONFIG_NAME,
  mutationTsconfig,
  writeMutationTsconfig,
} from './mutation-tsconfig.ts';
export {
  aggregateParsedReports,
  aggregateReports,
  addStatus,
  mutationScore,
  parseStatus,
} from './report.ts';
export { runtimeInputHash, } from './runtime-inputs.ts';
export {
  buildRuntimeImage,
  buildRuntimeImageArgs,
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
 * Extracts CLI exit code from a caught error.
 *
 * @param error - Unknown caught error.
 *
 * @returns Exit code to report to the process supervisor.
 *
 * @example
 * ```ts
 * cliExitCode({ exitCode: 2 });
 * // 2
 * ```
 */
function cliExitCode(error: unknown,): number {
  return ((typeof error) === 'object')
    && (error !== null)
    && ('exitCode' in error)
    && ((typeof error.exitCode) === 'number')
    ? error.exitCode
    : 1;
}

/**
 * Formats CLI errors without asking Node to dump bundled source context.
 *
 * @param error - Unknown caught error.
 *
 * @returns Concise user-facing error message.
 *
 * @example
 * ```ts
 * cliErrorMessage(new Error('bad'));
 * // 'Error: bad'
 * ```
 */
function cliErrorMessage(error: unknown,): string {
  if (error instanceof Error)
    return `${error.name}: ${error.message}`;

  return `Error: ${String(error,)}`;
}

/**
 * Runs the direct CLI entrypoint and reports concise failures.
 *
 * @param argv - CLI arguments after executable and script path.
 *
 * @example
 * ```ts
 * await runDirectCli(['--package', 'packages/dev-script/file-enforcer']);
 * ```
 */
async function runDirectCli(argv: readonly string[],): Promise<void> {
  try {
    await runCli(argv,);
  }
  catch (error) {
    console.error(cliErrorMessage(error,),);
    process.exitCode = cliExitCode(error,);
  }
}

/**
 * Whether this module is running as the process entrypoint.
 */
const isDirectEntrypoint = (process.argv[1] !== undefined)
  && (import.meta.url
    === pathToFileURL(process.argv[1],)
    .href);

if (isDirectEntrypoint) {
  await runDirectCli(process.argv
    .slice(2,),);
}
