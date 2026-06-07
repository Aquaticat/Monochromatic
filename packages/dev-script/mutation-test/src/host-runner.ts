/**
 * Host-side mutation run orchestration.
 *
 * @example
 * ```ts
 * await runCli(['--package', 'packages/dev-script/file-enforcer', 'src/io/glob.ts']);
 * ```
 */

import { mkdtemp, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, resolve, } from 'node:path';

import spawn from 'nano-spawn';

import { parseCliOptions, } from './cli-options.ts';
import { buildContainerArgs, } from './container-args.ts';
import {
  defaultWorkerCount,
  findRepoRoot,
  reportNameForSource,
  resolveRequestedSources,
  runBounded,
} from './host-utils.ts';
import { aggregateReports, } from './report.ts';
import { ensureRuntimeImage, } from './runtime-image.ts';
import { enumerateSourceFiles, } from './source-selection.ts';
import { selectTestsForSource, } from './test-selection.ts';
import type {
  CliOptions,
  ContainerResources,
  MutationRunResult,
  SourceRunResult,
} from './types.ts';

/**
 * Image tag fragment for the repo-pinned latest Node installed by mise.
 */
const NODE_TAG: string = 'node-latest';

/**
 * Extracts subprocess exit code from a thrown nano-spawn error.
 *
 * @param error - Unknown caught error.
 *
 * @returns Exit code for reporting.
 *
 * @example
 * ```ts
 * exitCodeFromError({ exitCode: 2 });
 * // 2
 * ```
 */
function exitCodeFromError(error: unknown,): number {
  return typeof error === 'object'
    && error !== null
    && 'exitCode' in error
    && typeof error.exitCode === 'number'
    ? error.exitCode
    : 1;
}

/**
 * Runs one per-source-file Podman container.
 *
 * @param options - Run context for one source file.
 *
 * @returns Container exit result and report path.
 *
 * @example
 * ```ts
 * await runSourceContainer({ ...context, sourceFile: 'src/a.ts' });
 * ```
 */
async function runSourceContainer(options: {
  readonly repoRoot: string;
  readonly packagePath: string;
  readonly packageRoot: string;
  readonly reportsDir: string;
  readonly runtimeImage: string;
  readonly resources: ContainerResources;
  readonly cli: CliOptions;
  readonly sourceFile: string;
},): Promise<SourceRunResult> {
  const started = performance.now();
  const tests = await selectTestsForSource({
    packageRoot: options.packageRoot,
    sourceFile: options.sourceFile,
    fullSuite: options.cli.fullSuite,
  },);
  const reportFileName = reportNameForSource(options.sourceFile,);
  const reportFile = join(options.reportsDir, reportFileName,);
  const args = buildContainerArgs({
    repoRoot: options.repoRoot,
    hostReportDir: options.reportsDir,
    runtimeImage: options.runtimeImage,
    targetPackagePath: options.packagePath,
    mutateFile: options.sourceFile,
    reportFileName,
    tests,
    resources: options.resources,
    selinuxRelabel: options.cli.selinuxRelabel,
    dryRunOnly: options.cli.dryRunOnly,
    fullSuite: options.cli.fullSuite,
    timeoutMS: options.cli.timeoutMS,
    prioritizePerformanceOverAccuracy: options.cli.prioritizePerformanceOverAccuracy,
  },);

  try {
    await spawn(
      'podman',
      args,
      {
        stdout: 'inherit',
        stderr: 'inherit',
        stdin: 'inherit',
      },
    );
    return {
      sourceFile: options.sourceFile,
      reportFile,
      exitCode: 0,
      wallClockMs: performance.now() - started,
    };
  }
  catch (error) {
    return {
      sourceFile: options.sourceFile,
      reportFile,
      exitCode: exitCodeFromError(error,),
      wallClockMs: performance.now() - started,
    };
  }
}

/**
 * Prints aggregate mutation counts and survivor details.
 *
 * @param result - Mutation run result.
 *
 * @returns Nothing.
 *
 * @example
 * ```ts
 * printRunSummary(result);
 * ```
 */
function printRunSummary(result: MutationRunResult,): void {
  console.log(`Mutation score: ${result.aggregate.score.toFixed(2,)}%`,);
  console.log(`Killed: ${String(result.aggregate.totals.killed,)}`,);
  console.log(`Survived: ${String(result.aggregate.totals.survived,)}`,);
  console.log(`Timeout: ${String(result.aggregate.totals.timeout,)}`,);
  console.log(`CompileError: ${String(result.aggregate.totals.compileError,)}`,);
  console.log(`RuntimeError: ${String(result.aggregate.totals.runtimeError,)}`,);
  console.log(`NoCoverage: ${String(result.aggregate.totals.noCoverage,)}`,);
  console.log(`Ignored: ${String(result.aggregate.totals.ignored,)}`,);

  for (const finding of result.aggregate.findings) {
    console.log(`${finding.status}: ${finding.file}:${finding.location} ${finding.mutatorName} ${finding.description}`,);
  }
}

/**
 * Runs mutation testing for parsed CLI options.
 *
 * @param cli - Parsed CLI options.
 *
 * @returns Mutation run result with aggregate report.
 *
 * @example
 * ```ts
 * await runMutation(parseCliOptions(['--package', 'packages/dev-script/file-enforcer', 'src/io/glob.ts']));
 * ```
 */
export async function runMutation(cli: CliOptions,): Promise<MutationRunResult> {
  const repoRoot = process.env.MISE_MONOREPO_ROOT ?? await findRepoRoot(process.cwd(),);
  const packageRoot = resolve(repoRoot, cli.packagePath,);
  const resources: ContainerResources = {
    memory: cli.memory,
    cpus: cli.cpus,
    pidsLimit: cli.pidsLimit,
    sessionTimeoutSeconds: cli.sessionTimeoutSeconds,
    workTmpfsSize: cli.workTmpfsSize,
  };
  const image = await ensureRuntimeImage({
    repoRoot,
    packageRoot: resolve(repoRoot, 'packages/dev-script/mutation-test',),
    nodeTag: NODE_TAG,
    skipBuild: cli.skipImageBuild,
  },);
  const selection = await enumerateSourceFiles({ packageRoot, },);
  const sourceFiles = resolveRequestedSources({
    allSources: selection.files,
    requested: cli.sourceFiles,
  },);
  const reportsDir = await mkdtemp(join(tmpdir(), 'mutation-reports-',),);
  const workers = cli.workers ?? defaultWorkerCount(resources,);

  console.log(`Mutation targets: ${String(sourceFiles.length,)} of ${String(selection.files.length,)} production source files`,);
  console.log(`Runtime image: ${image.reference}`,);
  console.log(`Reports: ${reportsDir}`,);
  console.log(`Outer workers: ${String(workers,)}`,);

  const sourceResults = await runBounded({
    items: sourceFiles,
    concurrency: workers,
    worker: async function runSource(options,): Promise<SourceRunResult> {
      return runSourceContainer({
        repoRoot,
        packagePath: cli.packagePath,
        packageRoot,
        reportsDir,
        runtimeImage: image.reference,
        resources,
        cli,
        sourceFile: options.item,
      },);
    },
  },);
  const aggregate = await aggregateReports(sourceResults.map(function reportFile(result,): string {
    return result.reportFile;
  },),);
  const result = {
    reportsDir,
    sourceResults,
    aggregate,
  };
  printRunSummary(result,);
  return result;
}

/**
 * Executes CLI and throws after reporting if any per-file container failed.
 *
 * @param argv - Arguments after executable and script path.
 *
 * @returns Promise resolving when run succeeds.
 *
 * @example
 * ```ts
 * await runCli(['--package', 'packages/dev-script/file-enforcer', 'src/io/glob.ts']);
 * ```
 */
export async function runCli(argv: readonly string[],): Promise<void> {
  const result = await runMutation(parseCliOptions(argv,),);
  const failed = result.sourceResults.filter(function failedSource(sourceResult,): boolean {
    return sourceResult.exitCode !== 0;
  },);

  if (failed.length > 0)
    throw new Error(`${String(failed.length,)} mutation containers failed; completed reports remain in ${result.reportsDir}`,);
}
