/**
 * Container test runner for ensurePackage.
 * Launches podman containers across the test matrix and runs
 * `ensure-package.container-test.ts` inside each.
 *
 * Test matrix:
 * - image: ubuntu:latest, fedora:latest
 * - user: root, non-root (uid 1000)
 *
 * Bun is installed inside each container before running the test.
 *
 * @example
 * ```bash
 * bun packages/dev-script/file-enforcer/src/package/mise.container-test.ts
 * ```
 */

import { findUp, } from 'find-up';
import spawn from 'nano-spawn';
import { readFileSync, } from 'node:fs';
import {
  dirname,
  resolve,
} from 'node:path';

/** Width of the separator lines printed between matrix entries for readability. */
const SEPARATOR_WIDTH = 60;

/**
 * Absolute path to the monorepo root.
 * Located by finding a `mise.toml` containing `[monorepo]` upward from this file.
 *
 * Uses `/var/home/user` as the canonical base to avoid symlink chains
 * where `readlink -f` resolves to literal `~` on some systems (e.g. Fedora ostree).
 * `resolve()` normalizes path without following symlinks.
 */
const rootMiseToml = await findUp(
  function isMonorepoRoot(directory: string,): string | undefined {
    const candidate = `${directory}/mise.toml`;
    try {
      const content = readFileSync(
        candidate,
        'utf8',
      );
      if (content.includes('\n[monorepo]\n',))
        return candidate;
    }
    catch {
      /* file does not exist -- keep searching */
    }
    return undefined;
  },
  {
    cwd: resolve(import.meta.dirname,),
    type: 'file',
  },
);
if (rootMiseToml === undefined) {
  throw new Error(
    'Could not find monorepo root (no mise.toml with [monorepo] section found upward)',
  );
}
/**
 * Use the path as-is from findUp, but ensure it's under `/var/home` not `/home`
 * to avoid the Fedora ostree symlink that resolves `~` literally.
 */
const rawRoot = dirname(rootMiseToml,);
/**
 * Canonical monorepo root path, normalized to `/var/home` on Fedora ostree
 * where `/home` is a symlink that breaks `readlink -f` resolution.
 */
const MONOREPO_ROOT = rawRoot.startsWith('/home/',)
  ? rawRoot.replace(
    '/home/',
    '/var/home/',
  )
  : rawRoot;

/** Package path relative to monorepo root */
const PKG_REL = 'packages/dev-script/file-enforcer';

/** Container test file relative to monorepo root */
const TEST_FILE = `${PKG_REL}/src/package/ensure-package.container-test.ts`;

/**
 * Test matrix entry.
 *
 * - `image` -- container image to use
 * - `asRoot` -- whether to run as root or create a non-root user
 * - `preInstall` -- commands to run before bun (e.g. install curl for bun installer)
 */
type MatrixEntry = {
  readonly image: string;
  readonly asRoot: boolean;
  readonly preInstall: string;
};

/** Container images and user contexts to test against, covering apt (Ubuntu) and dnf (Fedora) as root and non-root. */
const MATRIX: readonly MatrixEntry[] = [
  {
    image: 'ubuntu:latest',
    asRoot: true,
    preInstall: 'apt-get update && apt-get install -y curl unzip',
  },
  {
    image: 'ubuntu:latest',
    asRoot: false,
    preInstall:
      'apt-get update && apt-get install -y curl unzip sudo && useradd -m testuser && echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers',
  },
  {
    image: 'fedora:latest',
    asRoot: true,
    preInstall: 'dnf install -y unzip',
  },
  {
    image: 'fedora:latest',
    asRoot: false,
    preInstall:
      'dnf install -y unzip sudo && useradd -m testuser && echo "testuser ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers',
  },
] as const;

/**
 * Builds the shell command to run inside a container.
 * Installs bun, then runs the container test file.
 *
 * @param entry - Matrix entry defining the container configuration
 *
 * @returns Shell command string for `sh -c`
 */
function buildCommand(entry: MatrixEntry,): string {
  if (!entry.asRoot) {
    /**
     * Write a script to `/tmp/run-test.sh` to avoid nested quoting issues
     * with `su -c`. Heredoc with quoted delimiter preserves all special characters.
     * The script runs as testuser via `su -`.
     */
    return [
      entry.preInstall,
      `cat > /tmp/run-test.sh << 'TESTSCRIPT'\n#!/bin/sh\nset -e\ncd /workspace\ncurl -fsSL https://bun.sh/install | bash\n$HOME/.bun/bin/bun run /workspace/${TEST_FILE}\nTESTSCRIPT`,
      'chmod +x /tmp/run-test.sh',
      'sudo -u testuser -i /tmp/run-test.sh',
    ]
      .join(' && ',);
  }
  return [
    entry.preInstall,
    'curl -fsSL https://bun.sh/install | bash',
    'cd /workspace',
    `~/.bun/bin/bun run /workspace/${TEST_FILE}`,
  ]
    .join(' && ',);
}

/**
 * Runs a single matrix entry in a container.
 *
 * @param entry - Matrix entry to execute
 *
 * @returns Whether the test passed
 */
async function runEntry(entry: MatrixEntry,): Promise<boolean> {
  const label = `${entry.image} (${entry.asRoot ? 'root' : 'user'})`;
  console.log(`\n${'='.repeat(SEPARATOR_WIDTH,)}`,);
  console.log(`[matrix] ${label}`,);
  console.log('='.repeat(SEPARATOR_WIDTH,),);

  const command = buildCommand(entry,);

  try {
    const result = await spawn(
      'podman',
      [
        'run',
        '--rm',
        '-v',
        `${MONOREPO_ROOT}:/workspace:Z`,
        entry.image,
        'sh',
        '-c',
        command,
      ],
    );
    console.log(result.stdout,);
    if (result.stderr !== '')
      console.error(result.stderr,);
    console.log(`[matrix] ${label}: PASSED`,);
    return true;
  }
  catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error,);
    console.error(`[matrix] ${label}: FAILED`,);
    console.error(errorMessage,);
    return false;
  }
}

/** Run all matrix entries sequentially and report results */
const results: boolean[] = [];
for (const entry of MATRIX) {
  // oxlint-disable-next-line no-await-in-loop -- sequential: containers share state and must not overlap
  const passed = await runEntry(entry,);
  results.push(passed,);
}

console.log(`\n${'='.repeat(SEPARATOR_WIDTH,)}`,);
console.log('[matrix] Results:',);
for (const [i, entry,] of MATRIX.entries()) {
  const label = `${entry.image} (${entry.asRoot ? 'root' : 'user'})`;
  const status = results[i] === true ? 'PASSED' : 'FAILED';
  console.log(`  ${label}: ${status}`,);
}

/** Whether every matrix entry passed. */
const allPassed = results.every(Boolean,);
console.log(`\n[matrix] ${allPassed ? 'ALL PASSED' : 'SOME FAILED'}`,);
process.exitCode = allPassed ? 0 : 1;
