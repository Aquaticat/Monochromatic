import { validateName } from './config.ts';
import { l, tagged } from './log.ts';
import { getVmIp } from './virsh.ts';

/**
 * Opens an interactive SSH session to a running VM.
 * Disables strict host key checking since VM IPs are ephemeral.
 * Inherits stdin/stdout/stderr for full terminal passthrough.
 *
 * @param options - VM name without the mvm- prefix
 * @throws Error when the VM has no IP (not running or timed out)
 *
 * @example
 * ```ts
 * await shell({ name: 'dev-01' });
 * ```
 */
export async function shell({ name }: { name: string }): Promise<void> {
  validateName(name);
  const rl = tagged({ tag: shell.name, l, });

  rl.info(`connecting to VM ${name}...`);
  const ip = await getVmIp({ name, });

  rl.debug(`spawning ssh to ubuntu@${ip}`);
  const proc = Bun.spawn(
    ['ssh', '-o', 'StrictHostKeyChecking=no', '-o', 'UserKnownHostsFile=/dev/null', `ubuntu@${ip}`],
    { stderr: 'inherit', stdin: 'inherit', stdout: 'inherit', },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
