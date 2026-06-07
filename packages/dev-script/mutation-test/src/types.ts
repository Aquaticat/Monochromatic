/**
 * Shared type declarations for mutation-test orchestration.
 *
 * @example
 * ```ts
 * const status: MutantStatus = 'Killed';
 * ```
 */

/**
 * Stryker mutant statuses aggregated by this package.
 */
export type MutantStatus =
  | 'Killed'
  | 'Survived'
  | 'Timeout'
  | 'CompileError'
  | 'RuntimeError'
  | 'NoCoverage'
  | 'Ignored';

/**
 * Raw aggregate counts printed after per-file Stryker runs complete.
 */
export type MutationTotals = {
  readonly killed: number;
  readonly survived: number;
  readonly timeout: number;
  readonly compileError: number;
  readonly runtimeError: number;
  readonly noCoverage: number;
  readonly ignored: number;
};

/**
 * Survivor or timeout detail reported to users after aggregation.
 */
export type MutantFinding = {
  readonly file: string;
  readonly id: string;
  readonly mutatorName: string;
  readonly replacement: string;
  readonly status: MutantStatus;
  readonly location: string;
  readonly description: string;
};

/**
 * Aggregated result from one or more Stryker JSON reports.
 */
export type MutationAggregate = {
  readonly totals: MutationTotals;
  readonly score: number;
  readonly findings: readonly MutantFinding[];
  readonly reportFiles: readonly string[];
  readonly failedReports: readonly string[];
};

/**
 * Source files selected for mutation and exclusions discovered while scanning.
 */
export type SourceSelection = {
  readonly files: readonly string[];
  readonly excluded: readonly SourceExclusion[];
};

/**
 * File skipped during source selection with its explicit reason.
 */
export type SourceExclusion = {
  readonly file: string;
  readonly reason: string;
};

/**
 * Options for scanning package source files.
 */
export type SourceSelectionOptions = {
  readonly packageRoot: string;
  readonly srcDir?: string;
  readonly extraExclusions?: Readonly<Record<string, string>>;
};

/**
 * Options for selecting tests for a mutation target.
 */
export type TestSelectionOptions = {
  readonly packageRoot: string;
  readonly sourceFile: string;
  readonly fullSuite: boolean;
  readonly packageWideTests?: readonly string[];
};

/**
 * Options for building the inline Stryker config.
 */
export type StrykerConfigOptions = {
  readonly mutateFile: string;
  readonly reportFile: string;
  readonly dryRunOnly: boolean;
  readonly timeoutMS: number;
  readonly prioritizePerformanceOverAccuracy: boolean;
  readonly tsconfigFile: string;
};

/**
 * Resource limits applied to each per-source-file container.
 */
export type ContainerResources = {
  readonly memory: string;
  readonly cpus: string;
  readonly pidsLimit: number;
  readonly sessionTimeoutSeconds: number;
  readonly workTmpfsSize: string;
};

/**
 * Options for building a Podman argv vector.
 */
export type ContainerArgsOptions = {
  readonly repoRoot: string;
  readonly hostReportDir: string;
  readonly runtimeImage: string;
  readonly targetPackagePath: string;
  readonly mutateFile: string;
  readonly reportFileName: string;
  readonly tests: readonly string[];
  readonly resources: ContainerResources;
  readonly selinuxRelabel: boolean;
  readonly dryRunOnly: boolean;
  readonly fullSuite: boolean;
  readonly timeoutMS: number;
  readonly prioritizePerformanceOverAccuracy: boolean;
};

/**
 * Runtime image identity and Containerfile inputs.
 */
export type RuntimeImageOptions = {
  readonly repoRoot: string;
  readonly packageRoot: string;
  readonly nodeTag: string;
  readonly platformOverride?: string;
};

/**
 * Resolved local runtime image reference.
 */
export type RuntimeImage = {
  readonly reference: string;
  readonly lockHash: string;
  readonly runtimeHash: string;
  readonly platform: string;
};

/**
 * Parsed host CLI options.
 */
export type CliOptions = {
  readonly packagePath: string;
  readonly sourceFiles: readonly string[];
  readonly fullSuite: boolean;
  readonly dryRunOnly: boolean;
  readonly workers?: number;
  readonly memory: string;
  readonly cpus: string;
  readonly pidsLimit: number;
  readonly sessionTimeoutSeconds: number;
  readonly workTmpfsSize: string;
  readonly selinuxRelabel: boolean;
  readonly skipImageBuild: boolean;
  readonly timeoutMS: number;
  readonly prioritizePerformanceOverAccuracy: boolean;
};

/**
 * Per-source-file container result observed by the host orchestrator.
 */
export type SourceRunResult = {
  readonly sourceFile: string;
  readonly reportFile: string;
  readonly exitCode: number;
  readonly wallClockMs: number;
};

/**
 * Host orchestration result for a mutation run.
 */
export type MutationRunResult = {
  readonly reportsDir: string;
  readonly sourceResults: readonly SourceRunResult[];
  readonly aggregate: MutationAggregate;
};
