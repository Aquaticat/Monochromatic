/**
 * Container-side Stryker config writing and execution.
 *
 * @example
 * ```ts
 * await runStryker({ options, packageCwd: '/work/packages/dev-script/file-enforcer' });
 * ```
 */

import {
  mkdir,
  mkdtemp,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  basename,
  dirname,
  join,
} from 'node:path';

import spawn from 'nano-spawn';

import {
  REPORT_MOUNT,
  SELECTED_TESTS_ENV,
} from './container-args.ts';
import { TEST_FILES_ENV, } from './inline-nu.ts';
import type { InContainerOptions, } from './in-container-options.ts';
import { sanitizeTagFragment, } from './path-utils.ts';
import { buildStrykerConfig, } from './stryker-config.ts';

/**
 * Default per-mutant timeout in milliseconds when the host does not override it.
 */
const DEFAULT_TIMEOUT_MS = 5_000;

/**
 * Reads selected tests from the host-provided environment variable.
 *
 * @returns Selected package-relative test files.
 *
 * @example
 * ```ts
 * process.env.MUTATION_SELECTED_TEST_FILES_JSON = '["src/a.unit.test.ts"]';
 * readSelectedTests();
 * ```
 */
export function readSelectedTests(): readonly string[] {
  /**
   * Raw JSON string of selected test files from host.
   */
  const raw = process.env[SELECTED_TESTS_ENV];

  if (raw === undefined)
    throw new Error(`Missing ${SELECTED_TESTS_ENV}`,);

  /**
   * Parsed selected-test value before runtime validation.
   */
  const parsed = JSON.parse(raw,) as unknown;

  if ((!Array.isArray(parsed,)) || (!parsed.every(function isString(value,): value is string {
    return (typeof value) === 'string';
  },)))
    throw new Error(`${SELECTED_TESTS_ENV} must be a JSON string array`,);

  return parsed;
}

/**
 * Reads per-mutant timeout from environment.
 *
 * @returns Timeout in milliseconds.
 *
 * @example
 * ```ts
 * timeoutMsFromEnv();
 * ```
 */
function timeoutMsFromEnv(): number {
  /**
   * Raw per-mutant timeout override from environment.
   */
  const raw = process.env
    .MUTATION_TIMEOUT_MS;

  if (raw === undefined)
    return DEFAULT_TIMEOUT_MS;

  /**
   * Numeric timeout parsed from environment.
   */
  const parsed = Number(raw,);

  if ((!Number.isFinite(parsed,)) || (parsed <= 0))
    throw new Error(`MUTATION_TIMEOUT_MS must be positive, received ${raw}`,);

  return parsed;
}

/**
 * Writes Stryker config for one source file.
 *
 * @param options - Container options and config directory.
 *
 * @returns Absolute config path.
 *
 * @example
 * ```ts
 * await writeStrykerConfig({ options, configDir: '/tmp/x' });
 * ```
 */
async function writeStrykerConfig(options: {
  readonly options: InContainerOptions;
  readonly configDir: string;
},): Promise<string> {
  /**
   * File-name-safe report stem for temporary config naming.
   */
  const reportStem = sanitizeTagFragment(basename(options.options
    .reportFile,),);
  /**
   * Temporary Stryker config path outside package tree.
   */
  const configFile = join(
    options.configDir,
    `${reportStem}.stryker.config.json`,
  );
  await writeFile(
    configFile,
    `${JSON.stringify(
      buildStrykerConfig({
      mutateFile: options.options
        .mutateFile,
      reportFile: options.options
        .reportFile,
      dryRunOnly: options.options
        .dryRunOnly,
      timeoutMS: timeoutMsFromEnv(),
      prioritizePerformanceOverAccuracy:
        process.env
          .MUTATION_TYPESCRIPT_PERFORMANCE_MODE
          === 'true',
      tsconfigFile: 'tsconfig.json',
    },),
      null,
      2,
    )}\n`,
    'utf8',
  );
  return configFile;
}

/**
 * Builds environment for Stryker and its command runner children.
 *
 * @param tests - Package-relative tests selected by host.
 *
 * @returns Environment variables for `nano-spawn`.
 *
 * @example
 * ```ts
 * strykerEnvironment(['src/a.unit.test.ts']);
 * ```
 */
function strykerEnvironment(tests: readonly string[],): NodeJS.ProcessEnv {
  return {
    ...process.env,
    [TEST_FILES_ENV]: JSON.stringify(tests,),
  };
}

/**
 * Runs Stryker CLI in the prepared work tree.
 *
 * @param options - Container options and package cwd.
 *
 * @example
 * ```ts
 * await runStryker({ options, packageCwd: '/work/packages/dev-script/file-enforcer' });
 * ```
 */
export async function runStryker(options: {
  readonly options: InContainerOptions;
  readonly packageCwd: string;
},): Promise<void> {
  await mkdir(
    dirname(options.options
      .reportFile,),
    { recursive: true, },
  );
  await realpath(REPORT_MOUNT,);
  /**
   * Temporary directory holding generated Stryker config.
   */
  const configDir = await mkdtemp(join(
    tmpdir(),
    'mutation-stryker-',
  ),);
  /**
   * Generated Stryker config path passed to CLI.
   */
  const configFile = await writeStrykerConfig({
    options: options.options,
    configDir,
  },);
  /**
   * Selected package-relative tests for this Stryker session.
   */
  const tests = readSelectedTests();
  await spawn(
    'node_modules/.bin/stryker',
    [
      'run',
      configFile,
    ],
    {
      cwd: options.packageCwd,
      stdout: 'inherit',
      stderr: 'inherit',
      stdin: 'inherit',
      env: strykerEnvironment(tests,),
    },
  );
}
