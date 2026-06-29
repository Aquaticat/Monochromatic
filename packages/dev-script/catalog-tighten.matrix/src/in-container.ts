/**
 * In-container entrypoint for one catalog-tighten matrix combination.
 *
 * Runs inside a podman container with the monorepo mounted read-only at `/repo`
 * and a writable tmpfs at `/work`. Reads a {@link LayoutCombo} from argv, writes
 * the fixture workspace into `/work`, installs it with pnpm (via corepack) under
 * the combination's baked-in layout, seeds a stale orphan when asked, runs
 * catalog-tighten against the fixture, and asserts the catalog floor was
 * tightened to the active installed version. Throws (non-zero exit) on mismatch.
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  join,
} from 'node:path';

import spawn from 'nano-spawn';

import {
  buildWorkspaceYaml,
  EXPECTED_TIGHTENED,
  FIXTURE_CONSUMER_PACKAGE_JSON,
  FIXTURE_ORPHAN,
  FIXTURE_PACKAGE,
  FIXTURE_ROOT_PACKAGE_JSON,
  type LayoutCombo,
} from './combos.ts';

//region Container paths

/**
 * Writable fixture work directory (tmpfs) inside the container.
 */
const WORK_DIR = '/work';

/**
 * Read-only monorepo mount inside the container; the tool and its deps resolve here.
 */
const REPO_DIR = '/repo';

/**
 * catalog-tighten entrypoint inside the mounted repo.
 */
const TOOL_ENTRY = join(
  REPO_DIR,
  'packages',
  'dev-script',
  'catalog-tighten',
  'src',
  'index.ts',
);

/**
 * Pinned pnpm version matching the monorepo, so the fixture install layout mirrors production.
 */
const PINNED_PNPM = 'pnpm@11.9.0';

/**
 * Indentation passed to `JSON.stringify` for the seeded orphan manifest.
 */
const JSON_INDENT = 2;

//endregion Container paths

//region Steps

/**
 * Writes the fixture workspace for `combo` into {@link WORK_DIR}: the workspace
 * file with the combination's settings, the root manifest, and one consumer
 * package depending on the catalog entry.
 *
 * @param combo - combination whose settings shape the workspace file
 *
 * @example
 * ```ts
 * await writeFixture({ label: 'pnp', nodeLinker: 'pnp', hoist: false, staleOrphan: false });
 * ```
 */
async function writeFixture(combo: LayoutCombo,): Promise<void> {
  /**
   * Consumer package directory under the `packages/*\/*` glob the tool discovers.
   */
  const consumerDir = join(
    WORK_DIR,
    'packages',
    'grp',
    'consumer',
  );
  await mkdir(
    consumerDir,
    { recursive: true, },
  );
  await writeFile(
    join(
      WORK_DIR,
      'pnpm-workspace.yaml',
    ),
    buildWorkspaceYaml(combo,),
  );
  await writeFile(
    join(
      WORK_DIR,
      'package.json',
    ),
    FIXTURE_ROOT_PACKAGE_JSON,
  );
  await writeFile(
    join(
      consumerDir,
      'package.json',
    ),
    FIXTURE_CONSUMER_PACKAGE_JSON,
  );
}

/**
 * Installs the fixture with the pinned pnpm via corepack. Layout settings live
 * in the workspace file, so this is a plain install; corepack caches pnpm under
 * `HOME` (tmpfs) and the download prompt is disabled for non-interactive runs.
 *
 * @example
 * ```ts
 * await installFixture();
 * ```
 */
async function installFixture(): Promise<void> {
  await spawn(
    'corepack',
    [
      PINNED_PNPM,
      'install',
      '--ignore-scripts',
      '--config.confirmModulesPurge=false',
    ],
    {
      cwd: WORK_DIR,
      env: {
        ...process.env,
        COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
        HOME: '/tmp',
      },
    },
  );
}

/**
 * Seeds a higher-version stale orphan into the virtual store, with no symlink
 * pointing at it, reproducing the post-downgrade leftover from
 * `docs/troubleshooting/pnpm-modules-cache.md`. The resolver must ignore it.
 *
 * @example
 * ```ts
 * await seedStaleOrphan();
 * ```
 */
async function seedStaleOrphan(): Promise<void> {
  /**
   * Virtual-store package directory for the orphan version, mirroring pnpm's `.pnpm` layout.
   */
  const orphanDir = join(
    WORK_DIR,
    'node_modules',
    '.pnpm',
    `${FIXTURE_PACKAGE}@${FIXTURE_ORPHAN}`,
    'node_modules',
    FIXTURE_PACKAGE,
  );
  await mkdir(
    orphanDir,
    { recursive: true, },
  );
  await writeFile(
    join(
      orphanDir,
      'package.json',
    ),
    `${
      JSON.stringify(
        {
          name: FIXTURE_PACKAGE,
          version: FIXTURE_ORPHAN,
        },
        undefined,
        JSON_INDENT,
      )
    }\n`,
  );
}

/**
 * Runs catalog-tighten `--dry-run` against the fixture and returns its stdout.
 *
 * @returns combined tool stdout
 *
 * @example
 * ```ts
 * const out = await runTool();
 * ```
 */
async function runTool(): Promise<string> {
  /**
   * Tool invocation result; nano-spawn rejects on a non-zero exit, surfacing tool failures.
   */
  const result = await spawn(
    'node',
    [
      TOOL_ENTRY,
      '--dry-run',
    ],
    { cwd: WORK_DIR, },
  );
  return result.stdout;
}

//endregion Steps

//region Main

/**
 * argv index of the combination JSON the orchestrator passes.
 */
const COMBO_ARG_INDEX = 2;

/**
 * Raw combination JSON argument; absent only on misuse.
 */
const comboJson = process.argv[COMBO_ARG_INDEX];
if (comboJson === undefined)
  throw new Error('Usage: in-container.ts <combo-json>',);

/**
 * Combination to run, deserialised from the orchestrator's argument.
 */
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the orchestrator serialises a LayoutCombo it owns
const combo = JSON.parse(comboJson,) as LayoutCombo;

await writeFixture(combo,);
await installFixture();
if (combo.staleOrphan)
  await seedStaleOrphan();

/**
 * Tool output to assert against the expected tightened line.
 */
const output = await runTool();
if (!output.includes(EXPECTED_TIGHTENED,)) {
  throw new Error(
    `[${combo.label}] expected "${EXPECTED_TIGHTENED}" in tool output, got:\n${output}`,
  );
}
console.info(`[${combo.label}] PASS: ${EXPECTED_TIGHTENED}`,);

export {};

//endregion Main
