import { randomBytes } from 'node:crypto';

import { clone } from './clone.ts';
import { create } from './create.ts';
import { destroy } from './destroy.ts';
import { exec, type ExecResult } from './exec.ts';
import { l, tagged } from './log.ts';

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
  const suffix = randomBytes(NAME_RANDOM_BYTES).toString('hex');
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
 * @param options - Command to execute and optional source VM to clone from
 * @returns Captured stdout, stderr, and exit code from the command
 * @throws Error when VM creation, command execution, or cleanup fails
 *
 * @example
 * ```ts
 * const result = await ephemeralExec({ command: 'uname -a' });
 * // Creates a fresh VM, runs the command, destroys it
 *
 * const cloned = await ephemeralExec({ command: 'cat /etc/hostname', from: 'dev-01' });
 * // Clones from dev-01, runs the command, destroys the clone
 * ```
 */
export async function ephemeralExec({ command, from }: { command: string; from: string | undefined }): Promise<ExecResult> {
  const rl = tagged({ tag: ephemeralExec.name, l });
  const name = generateEphemeralName();

  rl.info(`ephemeral VM: ${name}${from !== undefined ? ` (cloned from ${from})` : ' (fresh)'}`);

  /** Destroys the ephemeral VM, logging but not re-throwing errors. */
  const cleanup = async (): Promise<void> => {
    rl.info(`destroying ephemeral VM ${name}`);
    try {
      await destroy({ name });
    } catch (err: unknown) {
      rl.info(`cleanup failed for ${name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  /** Signal handler that runs cleanup then re-raises the signal. */
  const onSignal = (signal: NodeJS.Signals): void => {
    rl.info(`received ${signal}, cleaning up...`);
    void cleanup().finally(() => {
      process.kill(process.pid, signal);
    });
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  try {
    if (from !== undefined) {
      await clone({ destination: name, source: from });
    } else {
      await create({ name });
    }

    const result = await exec({ command, name });
    return result;
  } finally {
    process.removeListener('SIGINT', onSignal);
    process.removeListener('SIGTERM', onSignal);
    await cleanup();
  }
}
