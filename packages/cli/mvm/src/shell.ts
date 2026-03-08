import { LIBVIRT_URI, VM_PREFIX, validateName } from './config.ts';
import { l, tagged } from './log.ts';

/**
 * Opens an interactive serial console session to a running VM via `virsh console`.
 * The VM is configured with auto-login on ttyS0, so no credentials are needed.
 * Press `Ctrl+]` to disconnect from the console.
 *
 * @param options - VM name without the mvm- prefix
 *
 * @example
 * ```ts
 * await shell({ name: 'dev-01' });
 * ```
 */
export async function shell({ name }: { name: string }): Promise<void> {
  validateName(name);
  const rl = tagged({ tag: shell.name, l, });
  const fullName = `${VM_PREFIX}${name}`;

  rl.info(`connecting to VM ${name} via console (press Ctrl+] to disconnect, not exit)`);

  const proc = Bun.spawn(
    ['virsh', '--connect', LIBVIRT_URI, 'console', fullName],
    { stderr: 'inherit', stdin: 'inherit', stdout: 'inherit', },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    process.exitCode = exitCode;
  }
}
