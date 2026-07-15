/**
 * Runtime installation scripts and execution commands.
 *
 * Each supported JS runtime has an install script (fetched via curl)
 * and a command pattern for executing test files.
 */

import type { Runtime, } from './types.ts';

//region Runtime install scripts

/**
 * Install commands for each supported runtime.
 * All use curl to fetch an installer script and pipe to a shell.
 *
 * Post-install, the runtime binary is available at a predictable path
 * under `$HOME` (bun: `$HOME/.bun/bin/bun`, deno: `$HOME/.deno/bin/deno`).
 */
const RUNTIME_INSTALL: Record<Runtime, string> = {
  bun: 'curl -fsSL https://bun.sh/install | bash',
  deno: 'curl -fsSL https://deno.land/install.sh | sh',
};

/**
 * Absolute path to the runtime binary after installation.
 * Uses `$HOME` variable so it resolves correctly for both root and non-root users.
 */
const RUNTIME_BIN: Record<Runtime, string> = {
  bun: '$HOME/.bun/bin/bun',
  deno: '$HOME/.deno/bin/deno',
};

/**
 * Returns the shell command to install a JS runtime inside a container.
 *
 * @param runtime - Runtime to install
 *
 * @returns shell command string
 *
 * @example
 * ```ts
 * runtimeInstallCommand('bun');
 * // 'curl -fsSL https://bun.sh/install | bash'
 * ```
 */
export function runtimeInstallCommand(runtime: Runtime,): string {
  return RUNTIME_INSTALL[runtime];
}

/**
 * Returns the shell command to execute a file with the given runtime.
 *
 * @param runtime - Runtime to use
 *
 * @param filePath - Absolute path to the file inside the container
 *
 * @returns shell command string
 *
 * @example
 * ```ts
 * runtimeExecCommand({ runtime: 'bun', filePath: '/workspace/test.ts' });
 * // '$HOME/.bun/bin/bun run /workspace/test.ts'
 * ```
 */
export function runtimeExecCommand({
  runtime,
  filePath,
}: {
  readonly runtime: Runtime;
  readonly filePath: string;
},): string {
  /**
   * Captured for reuse across the deno-specific and default branches below.
   */
  const bin = RUNTIME_BIN[runtime];

  if (runtime === 'deno')
    return `${bin} run --allow-all ${filePath}`;

  return `${bin} run ${filePath}`;
}

//endregion Runtime install scripts
