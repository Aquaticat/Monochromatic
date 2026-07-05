#!/usr/bin/env node

/**
 * Host CLI entrypoint for the oxc-based mutation tester.
 *
 * @example
 * ```bash
 * mutation-test --package packages/module/fs-path
 * mutation-test --package packages/module/fs-path --dry-run src/trim.ts
 * ```
 */

import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { cwd, } from 'node:process';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { enumeratePackage, } from './host/enumerate-package.ts';
import {
  orchestrateRun,
  type OrchestrateOptions,
} from './host/orchestrate.ts';
import {
  buildRunReport,
  formatTerminalSummary,
} from './host/report.ts';

/**
 * Module logger for the CLI entrypoint.
 */
const l = tagged({ tag: 'mutation-test', },);

/**
 * Default mutants per shard; tuned after first benchmarks.
 */
const DEFAULT_SHARD_SIZE = 16;

/**
 * Default concurrent shard containers.
 */
const DEFAULT_CONTAINERS = 2;

/**
 * Default per-mutant test timeout floor in milliseconds.
 */
const DEFAULT_TIMEOUT_FLOOR_MS = 5_000;

/**
 * Default multiple of baseline test time allowed per mutant.
 */
const DEFAULT_TIMEOUT_FACTOR = 3;

/**
 * Default per-container session timeout in seconds.
 */
const DEFAULT_SESSION_TIMEOUT_SECONDS = 1_800;

/**
 * Default pids cap per container.
 */
const DEFAULT_PIDS_LIMIT = 512;

/**
 * Parsed CLI options plus run mode.
 */
export type CliOptions = OrchestrateOptions & {
  readonly dryRun: boolean;
  readonly reportFile: string;
};

/**
 * Reads one flag value, throwing when it is missing.
 *
 * @param options - Argv, cursor, and flag name.
 *
 * @returns Value following the flag.
 *
 * @throws Error when no value follows.
 *
 * @example
 * ```ts
 * flagValue({ argv: ['--x', 'y'], cursor: 0, name: '--x' });
 * // 'y'
 * ```
 */
function flagValue(options: {
  readonly argv: readonly string[];
  readonly cursor: number;
  readonly name: string;
},): string {
  /**
   * Candidate value following the flag.
   */
  const value = options.argv[options.cursor + 1];

  if ((value === undefined) || value.startsWith('--',))
    throw new Error(`${options.name} requires a value`,);

  return value;
}

/**
 * Parses one positive integer flag value.
 *
 * @param options - Raw value and flag name.
 *
 * @returns Parsed positive integer.
 *
 * @throws Error when not a positive integer.
 *
 * @example
 * ```ts
 * positiveInteger({ value: '4', name: '--containers' });
 * // 4
 * ```
 */
function positiveInteger(options: {
  readonly value: string;
  readonly name: string;
},): number {
  /**
   * Numeric parse of the flag value.
   */
  const parsed = Number(options.value,);

  if ((!Number.isInteger(parsed,)) || (parsed <= 0))
    throw new Error(`${options.name} must be a positive integer, received ${options.value}`,);

  return parsed;
}

/**
 * Parses CLI argv into run options.
 *
 * @param argv - Raw arguments after the bin name.
 *
 * @returns Parsed options.
 *
 * @throws Error on unknown flags or missing package path.
 *
 * @example
 * ```ts
 * parseCliOptions(['--package', 'packages/module/fs-path']);
 * ```
 */
export function parseCliOptions(argv: readonly string[],): CliOptions {
  /**
   * Mutable accumulator for parsed options.
   */
  const state = {
    packagePath: '',
    sourceFiles: [] as string[],
    fullSuite: false,
    dryRun: false,
    shardSize: DEFAULT_SHARD_SIZE,
    containers: DEFAULT_CONTAINERS,
    memory: '2g',
    cpus: '2',
    pidsLimit: DEFAULT_PIDS_LIMIT,
    sessionTimeoutSeconds: DEFAULT_SESSION_TIMEOUT_SECONDS,
    workTmpfsSize: '2g',
    selinuxRelabel: false,
    skipImageBuild: false,
    timeoutFloorMs: DEFAULT_TIMEOUT_FLOOR_MS,
    timeoutFactor: DEFAULT_TIMEOUT_FACTOR,
    reportFile: '',
    cursor: 0,
  };

  while (state.cursor < argv.length) {
    /**
     * Current argument under the cursor.
     */
    const arg = argv[state.cursor] ?? '';

    if (arg === '--package') {
      state.packagePath = flagValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--full-suite') {
      state.fullSuite = true;
      state.cursor += 1;
    }
    else if (arg === '--dry-run') {
      state.dryRun = true;
      state.cursor += 1;
    }
    else if (arg === '--selinux-relabel') {
      state.selinuxRelabel = true;
      state.cursor += 1;
    }
    else if (arg === '--skip-image-build') {
      state.skipImageBuild = true;
      state.cursor += 1;
    }
    else if (arg === '--shard-size') {
      state.shardSize = positiveInteger({
        value: flagValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--containers') {
      state.containers = positiveInteger({
        value: flagValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--memory') {
      state.memory = flagValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--cpus') {
      state.cpus = flagValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--pids-limit') {
      state.pidsLimit = positiveInteger({
        value: flagValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--session-timeout-seconds') {
      state.sessionTimeoutSeconds = positiveInteger({
        value: flagValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--work-tmpfs-size') {
      state.workTmpfsSize = flagValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--timeout-ms') {
      state.timeoutFloorMs = positiveInteger({
        value: flagValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--timeout-factor') {
      state.timeoutFactor = positiveInteger({
        value: flagValue({
          argv,
          cursor: state.cursor,
          name: arg,
        },),
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg === '--report') {
      state.reportFile = flagValue({
        argv,
        cursor: state.cursor,
        name: arg,
      },);
      state.cursor += 2;
    }
    else if (arg.startsWith('--',)) {
      throw new Error(`unknown flag ${arg}`,);
    }
    else {
      state.sourceFiles
        .push(arg,);
      state.cursor += 1;
    }
  }

  if (state.packagePath === '')
    throw new Error('--package <repo-relative path> is required',);

  return {
    repoRoot: cwd(),
    packagePath: state.packagePath,
    sourceFiles: state.sourceFiles,
    fullSuite: state.fullSuite,
    dryRun: state.dryRun,
    shardSize: state.shardSize,
    containers: state.containers,
    resources: {
      memory: state.memory,
      cpus: state.cpus,
      pidsLimit: state.pidsLimit,
      sessionTimeoutSeconds: state.sessionTimeoutSeconds,
      workTmpfsSize: state.workTmpfsSize,
    },
    selinuxRelabel: state.selinuxRelabel,
    skipImageBuild: state.skipImageBuild,
    timeoutFloorMs: state.timeoutFloorMs,
    timeoutFactor: state.timeoutFactor,
    reportFile: state.reportFile,
  };
}

/**
 * Runs the CLI flow for parsed options.
 *
 * @param options - Parsed CLI options.
 *
 * @throws Error on infra failure (red baseline, unresolved mutants).
 *
 * @example
 * ```ts
 * await runCli(parseCliOptions(['--package', 'packages/module/fs-path']));
 * ```
 */
export async function runCli(options: CliOptions,): Promise<void> {
  /**
   * Logger scoped to this invocation.
   */
  const rl = tagged({
    tag: runCli.name,
    l,
  },);

  if (options.dryRun) {
    /**
     * Enumeration-only view for the dry run.
     */
    const {
      groups,
      ignored,
    } = await enumeratePackage(options,);

    for (const group of groups) {
      // Raw console: user-facing CLI summary output.
      console.log(
        `${group.file}: ${String(group.mutants
          .length,)} mutants, tests: ${
          group.tests
            .join(', ',)
        }`,
      );
    }

    console.log(`Ignored by suppression: ${String(ignored.length,)}`,);
    return;
  }

  /**
   * Full orchestration outcome.
   */
  const outcome = await orchestrateRun(options,);
  /**
   * Native JSON run report.
   */
  const report = buildRunReport({
    outcome,
    packagePath: options.packagePath,
  },);
  /**
   * Report destination, defaulting beside the current directory.
   */
  const reportFile = options.reportFile === ''
    ? join(
      cwd(),
      'mutation-report.json',
    )
    : options.reportFile;
  await writeFile(
    reportFile,
    `${JSON.stringify(
      report,
      null,
      2,
    )}\n`,
    'utf8',
  );
  rl.info(`report written to ${reportFile}`,);

  // Raw console: user-facing CLI summary output.
  console.log(formatTerminalSummary(report,),);

  if (report.infraErrors
    .length
    > 0)
    throw new Error(
      `${String(report.infraErrors
        .length,)} infrastructure errors; see report ${reportFile}`,
    );
}

await runCli(
  parseCliOptions(process.argv
    .slice(2,),),
);
