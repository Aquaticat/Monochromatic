import { randomBytes, } from 'node:crypto';

import { clone, } from './clone.ts';
import { create, } from './create.ts';
import { destroy, } from './destroy.ts';
import {
  exec,
  type ExecResult,
} from './exec.ts';
import {
  l,
  tagged,
} from './log.ts';

/** Number of random bytes used to generate ephemeral VM name suffix. */
const NAME_RANDOM_BYTES = 4;

/**
 * Generates a unique ephemeral VM name using a random hex suffix.
 *
 * @returns Name in the format `ephemeral-<hex>`
 *
 * @example
 * ```ts
 * generateEphemeralName(); // => "ephemeral-a1b2c3d4"
 * ```
 */
function generateEphemeralName(): string {
  const suffix = randomBytes(NAME_RANDOM_BYTES,).toString('hex',);
  return `ephemeral-${suffix}`;
}

/**
 * Creates an ephemeral VM, executes a command inside it, and destroys the VM.
 * When `from` is provided, the VM is cloned from that source; otherwise a fresh
 * VM is created from the base image.
 *
 * Registers signal handlers for SIGINT and SIGTERM to ensure cleanup even on
 * interruption.
 *
 * @param command - Shell command to run inside the VM
 *
 * @param from - Source VM to clone from (creates fresh VM when undefined)
 *
 * @returns Captured stdout, stderr, and exit code from the command
 *
 * @throws Error when VM creation, command execution, or cleanup fails
 *
 * @example
 * ```ts
 * const result = await run({ command: 'uname -a' });
 * // Creates a fresh VM, runs the command, destroys it
 *
 * const cloned = await run({ command: 'cat /etc/hostname', from: 'dev-01' });
 * // Clones from dev-01, runs the command, destroys the clone
 * ```
 */
export async function run(
  { command, from, }: { command: string; from: string | undefined; },
): Promise<ExecResult> {
  const rl = tagged({ tag: run.name, l, },);
  const name = generateEphemeralName();

  rl.info(
    `ephemeral VM: ${name}${from !== undefined ? ` (cloned from ${from})` : ' (fresh)'}`,
  );

  /**
   * Destroys the ephemeral VM, logging but not re-throwing errors.
   */
  async function cleanup(): Promise<void> {
    rl.info(`destroying ephemeral VM ${name}`,);
    try {
      await destroy({ name, },);
    }
    catch (err: unknown) {
      rl.info(
        `cleanup failed for ${name}: ${
          err instanceof Error ? err.message : String(err,)
        }`,
      );
    }
  }

  /**
   * Signal handler that runs cleanup then re-raises the signal.
   *
   * @param signal - Signal name (`SIGINT` or `SIGTERM`)
   */
  function onSignal(signal: NodeJS.Signals,): void {
    rl.info(`received ${signal}, cleaning up...`,);
    void (async function cleanupAndReraise(): Promise<void> {
      try {
        await cleanup();
      }
      catch {
        // cleanup() already logs errors internally
      }
      process.kill(process.pid, signal,);
    })();
  }

  process.on('SIGINT', onSignal,);
  process.on('SIGTERM', onSignal,);

  await using _guard = {
    async [Symbol.asyncDispose](): Promise<void> {
      process.removeListener('SIGINT', onSignal,);
      process.removeListener('SIGTERM', onSignal,);
      await cleanup();
    },
  };

  await (from !== undefined
    ? clone({ destination: name, source: from, },)
    : create({ name, },));

  const result = await exec({ command, name, },);
  return result;
}
