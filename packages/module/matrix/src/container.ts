/**
 * Container backend for matrix test execution.
 *
 * Builds shell commands and spawns podman containers for each
 * combination in the test matrix.
 */

import spawn from 'nano-spawn';
import {
  detectPackageManager,
  prerequisiteCommand,
  userCreationCommand,
} from './distro.ts';
import {
  runtimeExecCommand,
  runtimeInstallCommand,
} from './runtime.ts';
import type {
  Combination,
  ParsedOs,
} from './types.ts';

/**
 * Parses an OS specification string into protocol and distro.
 *
 * @param os - OS specification with protocol prefix (e.g. `'container:ubuntu'`)
 *
 * @returns parsed protocol and distro
 *
 * @throws Error when the protocol prefix is missing or unrecognized
 *
 * @example
 * ```ts
 * parseOs('container:ubuntu');
 * // \{ protocol: 'container', distro: 'ubuntu' \}
 *
 * parseOs('container:fedora:39');
 * // \{ protocol: 'container', distro: 'fedora:39' \}
 * ```
 */
export function parseOs(os: string,): ParsedOs {
  const colonIndex = os.indexOf(':',);

  if (colonIndex === -1) {
    throw new Error(
      `OS specification "${os}" must have a protocol prefix (e.g. "container:ubuntu")`,
    );
  }

  const protocol = os.slice(
    0,
    colonIndex,
  );
  const distro = os.slice(colonIndex + 1,);

  if (protocol === 'container') {
    return {
      protocol,
      distro,
    };
  }

  if (protocol === 'host') {
    return {
      protocol,
      distro,
    };
  }

  if (protocol === 'vm') {
    return {
      protocol,
      distro,
    };
  }

  throw new Error(
    `Unknown protocol "${protocol}" in OS specification "${os}". Supported: container, host, vm`,
  );
}

/**
 * Builds the shell command to run inside a container for one combination.
 *
 * The command sequence:
 * 1.  Install prerequisites (curl, unzip, optionally sudo)
 * 2.  Create non-root user if needed
 * 3.  Install the JS runtime
 * 4.  Execute each test file
 *
 * For non-root users, writes a script to `/tmp/run-test.sh` and
 * executes it via `sudo -u testuser -i` to avoid nested quoting issues.
 *
 * @param combination - Fully resolved combination
 *
 * @param monorepoRoot - Absolute path to the monorepo root on the host
 *
 * @returns shell command string for `sh -c`
 */
export function buildContainerCommand({
  combination,
  monorepoRoot,
}: {
  readonly combination: Combination;
  readonly monorepoRoot: string;
},): string {
  const parsed = parseOs(combination.os,);
  const manager = detectPackageManager(parsed.distro,);
  const prerequisites = prerequisiteCommand({
    manager,
    user: combination.user,
  },);
  const userSetup = userCreationCommand({
    manager,
    user: combination.user,
  },);
  const runtimeInstall = runtimeInstallCommand(combination.runtime,);

  /** Path to the test file inside the container (mounted at /workspace). */
  const relativePath = combination.file.startsWith(monorepoRoot,)
    ? combination.file.slice(monorepoRoot.length + 1,)
    : combination.file;
  const containerFilePath = `/workspace/${relativePath}`;
  const execCommand = runtimeExecCommand({
    runtime: combination.runtime,
    filePath: containerFilePath,
  },);

  if (combination.user === 'user') {
    /**
     * Write a script to `/tmp/run-test.sh` to avoid nested quoting issues
     * with `sudo -u`. Heredoc with quoted delimiter preserves all special characters.
     */
    const scriptLines = [
      '#!/bin/sh',
      'set -e',
      'cd /workspace',
      runtimeInstall,
      execCommand,
    ].join('\n',);

    const parts = [
      prerequisites,
      userSetup,
      `cat > /tmp/run-test.sh << 'TESTSCRIPT'\n${scriptLines}\nTESTSCRIPT`,
      'chmod +x /tmp/run-test.sh',
      'sudo -u testuser -i /tmp/run-test.sh',
    ];

    return parts.join(' && ',);
  }

  const parts = [
    prerequisites,
    runtimeInstall,
    'cd /workspace',
    execCommand,
  ];

  return parts.join(' && ',);
}

/**
 * Resolves a distro name to a container image reference.
 * Appends `:latest` if no tag is specified.
 *
 * @param distro - Distro name (e.g. `'ubuntu'`, `'fedora:39'`)
 *
 * @returns container image reference (e.g. `'ubuntu:latest'`, `'fedora:39'`)
 */
function resolveImage(distro: string,): string {
  if (distro.includes(':',)) {
    return distro;
  }
  return `${distro}:latest`;
}

/**
 * Runs a single combination in a podman container.
 *
 * Mounts the monorepo root at `/workspace:Z` (SELinux relabel)
 * and executes the built command via `sh -c`.
 *
 * @param combination - Fully resolved combination to execute
 *
 * @param monorepoRoot - Absolute path to the monorepo root on the host
 *
 * @returns stdout from the container execution
 *
 * @throws Error with container stderr when the command fails
 *
 * @example
 * ```ts
 * const output = await runContainer({
 *   combination: {
 *     file: '/path/to/test.ts',
 *     os: 'container:ubuntu',
 *     user: 'root',
 *     runtime: 'bun',
 *   },
 *   monorepoRoot: '/var/home/user/Monochromatic',
 * });
 * ```
 */
export async function runContainer({
  combination,
  monorepoRoot,
}: {
  readonly combination: Combination;
  readonly monorepoRoot: string;
},): Promise<string> {
  const parsed = parseOs(combination.os,);

  if (parsed.protocol === 'vm') {
    throw new Error('vm: protocol not yet implemented',);
  }

  const image = resolveImage(parsed.distro,);
  const command = buildContainerCommand({
    combination,
    monorepoRoot,
  },);

  const result = await spawn(
    'podman',
    [
      'run',
      '--rm',
      '-v',
      `${monorepoRoot}:/workspace:Z`,
      image,
      'sh',
      '-c',
      command,
    ],
  );

  if (result.stderr !== '') {
    console.error(result.stderr,);
  }

  return result.stdout;
}
