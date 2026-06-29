/**
 * Containerised matrix verifying catalog-tighten across pnpm install layouts.
 *
 * For every {@link LayoutCombo}, runs one podman container (monorepo mounted
 * read-only, fixture installed in a tmpfs) that installs a fixture under that
 * layout and asserts catalog-tighten tightens the catalog floor to the active
 * version. Results report through `describe`/`it` from `@monochromatic-dev/module-test`.
 *
 * Needs podman and network (the fixture install pulls from the registry), so it
 * lives behind the `test:matrix` task rather than the standard `test:unit` run.
 *
 * @module
 */

import {
  join,
} from 'node:path';

import {
  describe,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  SCENARIOS,
  type Scenario,
} from './combos.ts';

//region Container configuration

/**
 * Directory of this file; the repo root is four levels up
 * (`src` -> package -> `dev-script` -> `packages` -> repo).
 */
const HERE = import.meta.dirname;

/**
 * Absolute monorepo root on the host, bind-mounted read-only into each container.
 */
const REPO_ROOT = join(
  HERE,
  '..',
  '..',
  '..',
  '..',
);

/**
 * In-container entrypoint path, resolved against the read-only `/repo` mount.
 */
const IN_CONTAINER_ENTRY = '/repo/packages/dev-script/catalog-tighten.matrix/src/in-container.ts';

/**
 * Base image: node with corepack and unflagged TypeScript stripping; pnpm is provisioned at runtime.
 */
const NODE_IMAGE = 'docker.io/library/node:24-slim';

/**
 * Per-container memory cap.
 */
const MEMORY_LIMIT = '2g';

/**
 * Per-container CPU cap.
 */
const CPU_LIMIT = '2';

/**
 * Per-container process cap.
 */
const PIDS_LIMIT = 512;

/**
 * Writable tmpfs size for the fixture work tree.
 */
const WORK_TMPFS_SIZE = '512m';

/**
 * Writable tmpfs size for `/tmp` (corepack cache, pnpm store, downloaded binaries).
 */
const TMP_TMPFS_SIZE = '1g';

/**
 * Maximum containers to run at once; each install is memory- and network-heavy.
 */
const MATRIX_CONCURRENCY = 2;

/**
 * Builds the `podman run` argv for one combination.
 *
 * @param scenario - scenario to execute; serialised as the entrypoint argument
 *
 * @returns argument vector excluding the `podman` executable
 *
 * @example
 * ```ts
 * buildPodmanArgs(SCENARIOS[0]).at(0) // 'run'
 * ```
 */
function buildPodmanArgs(scenario: Scenario,): readonly string[] {
  return [
    'run',
    '--rm',
    '--memory',
    MEMORY_LIMIT,
    '--cpus',
    CPU_LIMIT,
    '--pids-limit',
    String(PIDS_LIMIT,),
    '--read-only',
    '--security-opt=label=disable',
    '--tmpfs',
    `/work:rw,exec,size=${WORK_TMPFS_SIZE}`,
    '--tmpfs',
    `/tmp:rw,exec,size=${TMP_TMPFS_SIZE}`,
    '--env',
    'HOME=/tmp',
    '--volume',
    `${REPO_ROOT}:/repo:ro`,
    '--workdir',
    '/work',
    NODE_IMAGE,
    'node',
    IN_CONTAINER_ENTRY,
    JSON.stringify(scenario,),
  ];
}

//endregion Container configuration

//region Run

/**
 * Runs one combination in a container and fails the test on a non-zero exit or
 * a missing PASS marker.
 *
 * @param scenario - scenario to run
 *
 * @throws Error when the container exits non-zero or does not report PASS
 *
 * @example
 * ```ts
 * await runScenario(SCENARIOS[0]);
 * ```
 */
async function runScenario(scenario: Scenario,): Promise<void> {
  /**
   * Container result; nano-spawn rejects on a non-zero exit, surfacing a failed assertion.
   */
  const result = await spawn(
    'podman',
    buildPodmanArgs(scenario,),
  );
  if (!result.stdout
    .includes('PASS',)) {
    throw new Error(
      `[${scenario.label}] container did not report PASS:\n${result.stdout}\n${result.stderr}`,
    );
  }
}

await describe({
  name: 'catalog-tighten install-layout matrix',
  concurrency: MATRIX_CONCURRENCY,
  children: SCENARIOS.map(function scenarioCase(scenario,) {
    return it({
      name: scenario.label,
      fn: async () => {
        await runScenario(scenario,);
      },
    },);
  },),
},);

export {};

//endregion Run
