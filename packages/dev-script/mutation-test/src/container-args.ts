/**
 * Pure Podman argv construction for per-source-file mutation containers.
 *
 * @example
 * ```ts
 * buildContainerArgs({ ...options });
 * ```
 */

import { join, } from 'node:path';

import type { ContainerArgsOptions, } from './types.ts';

/**
 * Container environment variable carrying selected test paths to the entrypoint.
 */
export const SELECTED_TESTS_ENV: string = 'MUTATION_SELECTED_TEST_FILES_JSON';

/**
 * Read-only source mount point inside the runtime container.
 */
export const SOURCE_MOUNT: string = '/src-ro';

/**
 * Writable reports mount point inside the runtime container.
 */
export const REPORT_MOUNT: string = '/out';

/**
 * Writable work tree path inside the runtime container.
 */
export const WORK_MOUNT: string = '/work';

/**
 * Runtime entrypoint inside the baked image.
 */
export const BAKED_ENTRYPOINT: string = '/baked/packages/dev-script/mutation-test/src/in-container.ts';

/**
 * Adds SELinux relabel suffix when requested.
 *
 * @param options - Host path and relabel preference.
 *
 * @returns Podman volume source with optional `:Z` suffix appended by caller context.
 *
 * @example
 * ```ts
 * volumeMount({ hostPath: '/repo', containerPath: '/src-ro', mode: 'ro', selinuxRelabel: true });
 * ```
 */
export function volumeMount(options: {
  readonly hostPath: string;
  readonly containerPath: string;
  readonly mode: 'ro' | 'rw';
  readonly selinuxRelabel: boolean;
},): string {
  /**
   * Optional SELinux relabel suffix for hosts that require it.
   */
  const relabel = options.selinuxRelabel ? ',Z' : '';
  return `${options.hostPath}:${options.containerPath}:${options.mode}${relabel}`;
}

/**
 * Builds complete `podman run` argv for one source file.
 *
 * @param options - Container limits, mounts, image, and per-file arguments.
 *
 * @returns Argument vector excluding the `podman` executable.
 *
 * @example
 * ```ts
 * const args = buildContainerArgs({ ...options });
 * args.at(0);
 * // 'run'
 * ```
 */
export function buildContainerArgs(options: ContainerArgsOptions,): readonly string[] {
  /**
   * Container-visible report path passed to the Stryker entrypoint.
   */
  const reportPath = join(
    REPORT_MOUNT,
    options.reportFileName,
  );

  return [
    'run',
    '--rm',
    '--pull=never',
    '--network=none',
    '--read-only',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges',
    '--security-opt=label=disable',
    '--memory',
    options.resources
      .memory,
    '--cpus',
    options.resources
      .cpus,
    '--pids-limit',
    String(options.resources
      .pidsLimit,),
    '--timeout',
    String(options.resources
      .sessionTimeoutSeconds,),
    '--tmpfs',
    '/tmp:rw,exec,size=1g',
    '--tmpfs',
    `${WORK_MOUNT}:rw,exec,size=${options.resources
      .workTmpfsSize}`,
    '--env',
    'HOME=/tmp',
    '--env',
    'TMPDIR=/tmp',
    '--env',
    'XDG_CACHE_HOME=/tmp/.cache',
    '--env',
    `${SELECTED_TESTS_ENV}=${JSON.stringify(options.tests,)}`,
    '--env',
    `MUTATION_TIMEOUT_MS=${String(options.timeoutMS,)}`,
    '--env',
    `MUTATION_TYPESCRIPT_PERFORMANCE_MODE=${String(options.prioritizePerformanceOverAccuracy,)}`,
    '--volume',
    volumeMount({
      hostPath: options.repoRoot,
      containerPath: SOURCE_MOUNT,
      mode: 'ro',
      selinuxRelabel: options.selinuxRelabel,
    },),
    '--volume',
    volumeMount({
      hostPath: options.hostReportDir,
      containerPath: REPORT_MOUNT,
      mode: 'rw',
      selinuxRelabel: options.selinuxRelabel,
    },),
    '--workdir',
    WORK_MOUNT,
    options.runtimeImage,
    'node',
    BAKED_ENTRYPOINT,
    '--package',
    options.targetPackagePath,
    '--mutate',
    options.mutateFile,
    '--report',
    reportPath,
    '--dry-run-only',
    String(options.dryRunOnly,),
    '--full-suite',
    String(options.fullSuite,),
  ];
}
